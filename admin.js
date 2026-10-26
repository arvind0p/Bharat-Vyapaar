(() => {
  const $ = id => document.getElementById(id);
  const hasConfig = window.BV_SUPABASE_URL && window.BV_SUPABASE_ANON_KEY && window.supabase;
  const loginView = $('loginView'), dashboardView = $('dashboardView');
  if (!hasConfig) {
    $('loginMessage').textContent = 'Supabase setup incomplete. Add the publishable/anon key in config.js, then apply supabase-admin-setup.sql.';
    return;
  }
  const client = window.supabase.createClient(window.BV_SUPABASE_URL, window.BV_SUPABASE_ANON_KEY);
  let businesses = [], team = [], registrations = [], enquiries = [], logos = [], currentPhotoPath = '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const showGlobal = (msg, ok=false) => { const el=$('globalMessage'); el.textContent=msg; el.className='message global-message '+(ok?'success':'error'); };
  const showLoginMessage = msg => $('loginMessage').textContent = msg;
  const setLoggedIn = (user) => {
    loginView.hidden = true; dashboardView.hidden = false;
    $('signedInAs').textContent = user?.email ? `Signed in as ${user.email}` : '';
  };
  const requireAdmin = async user => {
    const {data,error}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
    if(error) throw error;
    if(!data) throw new Error('This account is not enabled as an admin. Add its user ID to admin_users using the SQL setup instructions.');
  };
  async function refreshAll() { await Promise.all([loadBusinesses(),loadTeam(),loadLogos(),loadRegistrations(),loadEnquiries()]); }
  async function loadBusinesses() {
    const {data,error}=await client.from('business_directory').select('*').order('business_name');
    if(error) { $('businessRows').innerHTML=`<tr><td colspan="5" class="empty-row">Could not load businesses: ${esc(error.message)}</td></tr>`; return; }
    businesses=data||[];
    $('businessRows').innerHTML=businesses.length?businesses.map(b=>`<tr>
      <td><strong>${esc(b.business_name)}</strong><br><span>${esc(b.description||'')}</span></td>
      <td>${esc([b.city,b.state].filter(Boolean).join(', ')||'—')}</td><td>${esc(b.business_segment||'—')}</td>
      <td><span class="status-pill ${b.is_public?'public':'hidden'}">${b.is_public?'Public':'Hidden'}</span></td>
      <td><div class="row-actions"><button class="edit-btn" data-edit-business="${esc(b.id)}">Edit</button><button class="hide-btn" data-toggle-business="${esc(b.id)}">${b.is_public?'Hide':'Publish'}</button><button class="delete-btn" data-delete-business="${esc(b.id)}">Delete</button></div></td>
    </tr>`).join(''):'<tr><td colspan="5" class="empty-row">No businesses yet. Click “Add business” to create the first listing.</td></tr>';
  }
  async function loadTeam() {
    const {data,error}=await client.from('team_advisory').select('*').order('sort_order').order('full_name');
    if(error) { $('teamRows').innerHTML=`<tr><td colspan="5" class="empty-row">Could not load team: ${esc(error.message)}. Apply the supplied SQL setup first.</td></tr>`; return; }
    team=data||[];
    $('teamRows').innerHTML=team.length?team.map(t=>`<tr>
      <td><strong>${esc(t.full_name)}</strong></td><td>${esc(t.role||'—')}</td><td>${esc(t.city_region||'—')}</td>
      <td><span class="status-pill ${t.is_active?'public':'hidden'}">${t.is_active?'Public':'Hidden'}</span></td>
      <td><div class="row-actions"><button class="edit-btn" data-edit-team="${esc(t.id)}">Edit</button><button class="hide-btn" data-toggle-team="${esc(t.id)}">${t.is_active?'Hide':'Publish'}</button><button class="delete-btn" data-delete-team="${esc(t.id)}">Delete</button></div></td>
    </tr>`).join(''):'<tr><td colspan="5" class="empty-row">No team members yet. Click “Add team member” to add one.</td></tr>';
  }

  async function loadLogos() {
    const {data,error}=await client.from('core_member_logos').select('*').order('sort_order').order('company_name');
    if(error) { $('logoRows').innerHTML=`<tr><td colspan="5" class="empty-row">Could not load logos: ${esc(error.message)}. Apply the updated SQL setup file in Supabase first.</td></tr>`; return; }
    logos=data||[];
    $('logoRows').innerHTML=logos.length?logos.map(l=>`<tr>
      <td><div style="display:flex;align-items:center;gap:12px"><img src="${esc(l.logo_url)}" alt="" style="width:76px;height:42px;object-fit:contain;background:#fff;border:1px solid #e5eaf2;border-radius:6px;padding:4px"><strong>${esc(l.company_name)}</strong></div></td>
      <td>${l.website_url?`<a href="${esc(l.website_url)}" target="_blank" rel="noopener noreferrer">${esc(l.website_url)}</a>`:'—'}</td>
      <td>${esc(l.sort_order??100)}</td>
      <td><span class="status-pill ${l.is_active?'public':'hidden'}">${l.is_active?'Public':'Hidden'}</span></td>
      <td><div class="row-actions"><button class="edit-btn" data-edit-logo="${esc(l.id)}">Edit</button><button class="hide-btn" data-toggle-logo="${esc(l.id)}">${l.is_active?'Hide':'Publish'}</button><button class="delete-btn" data-delete-logo="${esc(l.id)}">Delete</button></div></td>
    </tr>`).join(''):'<tr><td colspan="5" class="empty-row">No company logos yet. Click “Add company logo” to add the first one.</td></tr>';
  }
\n  async function loadRegistrations() {
    const {data,error}=await client.from('network_registrations').select('*').order('created_at',{ascending:false});
    if(error) {
      $('registrationRows').innerHTML=`<tr><td colspan="7" class="empty-row">Could not load registrations: ${esc(error.message)}. Check the registration table and admin RLS policies.</td></tr>`;
      return;
    }
    registrations=data||[];

    // Keep approval status aligned with the directory: if an approved registration
    // no longer has a corresponding business listing, reset it to "new".
    const approved = registrations.filter(r => String(r.status||'').toLowerCase()==='approved');
    if (approved.length) {
      const {data:directoryRows,error:directoryError}=await client
        .from('business_directory')
        .select('business_name,city');
      if (directoryError) {
        showGlobal('Registrations loaded, but directory status sync failed: '+directoryError.message);
      } else {
        const normalize = value => String(value||'').trim().replace(/\\s+/g,' ').toLocaleLowerCase();
        const hasListing = registration => (directoryRows||[]).some(b =>
          normalize(b.business_name)===normalize(registration.organization) &&
          normalize(b.city)===normalize(registration.city)
        );
        const stale = approved.filter(r => !hasListing(r));
        if (stale.length) {
          const {error:syncError}=await client
            .from('network_registrations')
            .update({status:'new'})
            .in('id',stale.map(r=>r.id));
          if (syncError) {
            showGlobal('Found approved registrations without directory listings, but could not reset their status: '+syncError.message);
          } else {
            const staleIds=new Set(stale.map(r=>String(r.id)));
            registrations=registrations.map(r=>staleIds.has(String(r.id))?{...r,status:'new'}:r);
            showGlobal('Updated '+stale.length+' registration status(es) because their business listing is no longer in the directory.',true);
          }
        }
      }
    }

    $('registrationRows').innerHTML=registrations.length?registrations.map(r=>{
      const status=String(r.status||'new');
      const statusClass=status==='approved'?'public':status==='rejected'?'hidden':'';
      const submitted=r.created_at?new Date(r.created_at).toLocaleString():'—';
      return `<tr>
        <td><strong>${esc(r.full_name)}</strong><br><span>${esc(r.email)}</span><br><span>${esc(r.phone)}</span></td>
        <td>${esc(r.organization)}</td>
        <td>${esc(r.city)}</td>
        <td>${esc(r.interest)}</td>
        <td>${esc(submitted)}</td>
        <td><span class="status-pill ${statusClass}">${esc(status)}</span></td>
        <td><div class="row-actions">
          <button class="edit-btn" data-edit-registration="${esc(r.id)}">Edit</button>
          <button class="hide-btn" data-registration-status="approved" data-registration-id="${esc(r.id)}">Approve</button>
          <button class="delete-btn" data-registration-status="rejected" data-registration-id="${esc(r.id)}">Reject</button>
        </div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="empty-row">No registrations received yet.</td></tr>';
  }
  async function loadEnquiries() {
    const {data,error}=await client.from('contact_enquiries').select('*').order('created_at',{ascending:false});
    if(error) {
      $('enquiryRows').innerHTML=`<tr><td colspan="6" class="empty-row">Could not load enquiries: ${esc(error.message)}. Run supabase-contact-enquiries.sql in Supabase SQL Editor.</td></tr>`;
      return;
    }
    enquiries=data||[];
    $('enquiryRows').innerHTML=enquiries.length?enquiries.map(q=>{
      const status=String(q.status||'new');
      const statusClass=status==='closed'?'hidden':status==='contacted'?'public':'';
      const submitted=q.created_at?new Date(q.created_at).toLocaleString():'—';
      return `<tr>
        <td><strong>${esc(q.full_name)}</strong><br><a href="mailto:${esc(q.email)}">${esc(q.email)}</a><br><span>${esc(q.phone||'Phone not provided')}</span></td>
        <td>${esc(q.subject)}</td>
        <td class="enquiry-message-cell">${esc(q.message)}</td>
        <td>${esc(submitted)}</td>
        <td><span class="status-pill ${statusClass}">${esc(status)}</span></td>
        <td><div class="row-actions">
          <button class="hide-btn" data-enquiry-status="contacted" data-enquiry-id="${esc(q.id)}" ${status==='contacted'?'disabled':''}>Mark contacted</button>
          <button class="delete-btn" data-enquiry-status="closed" data-enquiry-id="${esc(q.id)}" ${status==='closed'?'disabled':''}>Close</button>
        </div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="6" class="empty-row">No enquiries received yet.</td></tr>';
  }

  async function setEnquiryStatus(id,status) {
    const {error}=await client.from('contact_enquiries').update({status}).eq('id',id);
    if(error){showGlobal('Could not update enquiry: '+error.message);return;}
    showGlobal('Enquiry status updated to '+status+'.',true);
    await loadEnquiries();
  }
  function openRegistration(r) {
    $('registrationForm').hidden=false;
    $('registrationId').value=r.id;
    $('registrationName').value=r.full_name||'';
    $('registrationEmail').value=r.email||'';
    $('registrationPhone').value=r.phone||'';
    $('registrationOrganization').value=r.organization||'';
    $('registrationRole').value=r.role||'';
    $('registrationIndustry').value=r.industry||'';
    $('registrationCity').value=r.city||'';
    $('registrationWebsite').value=r.website||'';
    $('registrationInterest').value=r.interest||'';
    $('registrationDetails').value=r.details||'';
    $('registrationStatus').value=r.status||'new';
    $('registrationForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function setRegistrationStatus(id,status) {
    const registration = registrations.find(r => String(r.id) === String(id));
    if (!registration) {
      showGlobal('Registration not found. Refresh the registrations list and try again.');
      return;
    }

    // Approval also creates or publishes the corresponding public business listing.
    if (status === 'approved') {
      const businessName = String(registration.organization || '').trim();
      const city = String(registration.city || '').trim();

      if (!businessName) {
        showGlobal('Cannot approve this registration: business / organization name is missing.');
        return;
      }

      const { data: existing, error: lookupError } = await client
        .from('business_directory')
        .select('id')
        .eq('business_name', businessName)
        .eq('city', city)
        .limit(1);

      if (lookupError) {
        showGlobal('Could not check Business Directory for an existing listing: ' + lookupError.message);
        return;
      }

      if (existing && existing.length) {
        const { error: publishError } = await client
          .from('business_directory')
          .update({
            description: registration.details || '',
            state: '',
            country: 'India',
            business_segment: registration.industry || '',
            products: '',
            services: '',
            website: registration.website || '',
            is_public: true
          })
          .eq('id', existing[0].id);

        if (publishError) {
          showGlobal('Could not publish the existing business listing: ' + publishError.message);
          return;
        }
      } else {
        const { error: insertError } = await client
          .from('business_directory')
          .insert({
            business_name: businessName,
            description: registration.details || '',
            city: city,
            state: '',
            country: 'India',
            business_segment: registration.industry || '',
            products: '',
            services: '',
            website: registration.website || '',
            is_public: true
          });

        if (insertError) {
          showGlobal('Could not create the public Business Directory listing: ' + insertError.message);
          return;
        }
      }
    }

    const { error } = await client
      .from('network_registrations')
      .update({ status })
      .eq('id', id);

    if (error) {
      showGlobal('Business listing action completed, but registration status could not be updated: ' + error.message);
      await loadBusinesses();
      await loadRegistrations();
      return;
    }

    showGlobal(
      status === 'approved'
        ? 'Registration approved and business listing published in the Business Directory.'
        : 'Registration marked rejected.',
      true
    );
    await Promise.all([loadBusinesses(), loadRegistrations()]);
  }

  function openBusiness(b=null) {
    $('businessForm').hidden=false; $('businessFormTitle').textContent=b?'Edit business':'Add business';
    $('businessId').value=b?.id||''; $('businessName').value=b?.business_name||''; $('businessDescription').value=b?.description||'';
    $('businessCity').value=b?.city||''; $('businessState').value=b?.state||''; $('businessCountry').value=b?.country||'India';
    $('businessSegment').value=b?.business_segment||''; $('businessProducts').value=b?.products||''; $('businessServices').value=b?.services||'';
    $('businessWebsite').value=b?.website||''; $('businessPublic').checked=b?.is_public!==false;
    $('businessForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function openTeam(t=null) {
    $('teamForm').hidden=false; $('teamFormTitle').textContent=t?'Edit team member':'Add team member';
    $('teamId').value=t?.id||''; $('teamName').value=t?.full_name||''; $('teamRole').value=t?.role||'Core Team Member';
    $('teamCity').value=t?.city_region||''; $('teamBio').value=t?.bio||''; $('teamSort').value=t?.sort_order??100;
    $('teamActive').checked=t?.is_active!==false; currentPhotoPath=t?.photo_path||'';
    $('teamPhoto').value=''; $('currentPhotoWrap').hidden=!t?.photo_url;
    if(t?.photo_url) $('currentPhoto').src=t.photo_url;
    $('teamForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function openLogo(l=null) {
    $('logoForm').hidden=false; $('logoFormTitle').textContent=l?'Edit company logo':'Add company logo';
    $('logoId').value=l?.id||''; $('logoCompanyName').value=l?.company_name||'';
    $('logoWebsite').value=l?.website_url||''; $('logoSort').value=l?.sort_order??100;
    $('logoActive').checked=l?.is_active!==false; $('logoExistingUrl').value=l?.logo_url||'';
    $('logoExistingPath').value=l?.logo_path||''; $('logoImage').value='';
    $('currentLogoWrap').hidden=!l?.logo_url; if(l?.logo_url) $('currentLogo').src=l.logo_url;
    $('logoForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
\n  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault(); showLoginMessage('Signing in…');
    const {data,error}=await client.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
    if(error){showLoginMessage(error.message);return;}
    try { await requireAdmin(data.user); setLoggedIn(data.user); showLoginMessage(''); await refreshAll(); }
    catch(err){await client.auth.signOut();showLoginMessage(err.message||'Admin access denied.');}
  });
  $('logoutButton').addEventListener('click',async()=>{await client.auth.signOut();dashboardView.hidden=true;loginView.hidden=false;});
  $('newBusinessButton').addEventListener('click',()=>openBusiness());\n  $('newLogoButton').addEventListener('click',()=>openLogo());
  $('logoRows').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-logo]'), toggle=e.target.closest('[data-toggle-logo]'), del=e.target.closest('[data-delete-logo]');
    if(edit) openLogo(logos.find(x=>String(x.id)===edit.dataset.editLogo));
    if(toggle){const l=logos.find(x=>String(x.id)===toggle.dataset.toggleLogo);if(!l)return;const {error}=await client.from('core_member_logos').update({is_active:!l.is_active}).eq('id',l.id);if(error)showGlobal(error.message);else{showGlobal('Company logo visibility updated.',true);await loadLogos();}}
    if(del){const l=logos.find(x=>String(x.id)===del.dataset.deleteLogo);if(!l||!confirm(`Delete the logo for "${l.company_name}" permanently?`))return;
      const {error}=await client.from('core_member_logos').delete().eq('id',l.id);
      if(error){showGlobal(error.message);return;}
      if(l.logo_path) await client.storage.from('core-member-logos').remove([l.logo_path]);
      showGlobal('Company logo deleted.',true);await loadLogos();
    }
  });
  $('logoForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('logoId').value, old=logos.find(x=>String(x.id)===id);
    const file=$('logoImage').files[0]; let logo_url=old?.logo_url||'', logo_path=old?.logo_path||'';
    if(file){
      if(!['image/jpeg','image/png','image/webp','image/svg+xml'].includes(file.type)){showGlobal('Choose a JPG, PNG, WebP or SVG logo.');return;}
      if(file.size>5*1024*1024){showGlobal('Logo file must be 5 MB or smaller.');return;}
      const ext=file.type==='image/svg+xml'?'svg':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const path=`${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await client.storage.from('core-member-logos').upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError){showGlobal('Logo upload failed: '+uploadError.message+' — check that the updated SQL setup has been applied in Supabase.');return;}
      logo_path=path;
      const {data}=client.storage.from('core-member-logos').getPublicUrl(path); logo_url=data.publicUrl;
    } else if(!logo_url){showGlobal('Please select a company logo image.');return;}
    const record={company_name:$('logoCompanyName').value.trim(),website_url:$('logoWebsite').value.trim()||null,logo_url,logo_path,sort_order:Number($('logoSort').value)||0,is_active:$('logoActive').checked};
    const result=id?await client.from('core_member_logos').update(record).eq('id',id):await client.from('core_member_logos').insert(record);
    if(result.error){showGlobal('Could not save company logo: '+result.error.message);return;}
    if(file&&old?.logo_path) await client.storage.from('core-member-logos').remove([old.logo_path]);
    $('logoForm').hidden=true;showGlobal('Company logo saved successfully.',true);await loadLogos();
  });

  $('newTeamButton').addEventListener('click',()=>openTeam());
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.close).hidden=true));
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===btn));
    $('businessesPanel').hidden=btn.dataset.tab!=='businesses'; $('teamPanel').hidden=btn.dataset.tab!=='team'; $('logosPanel').hidden=btn.dataset.tab!=='logos'; $('registrationsPanel').hidden=btn.dataset.tab!=='registrations'; $('enquiriesPanel').hidden=btn.dataset.tab!=='enquiries'; if(btn.dataset.tab==='logos') loadLogos(); if(btn.dataset.tab==='registrations') loadRegistrations(); if(btn.dataset.tab==='enquiries') loadEnquiries();
  }));
  $('businessRows').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-business]'), toggle=e.target.closest('[data-toggle-business]'), del=e.target.closest('[data-delete-business]');
    if(edit) openBusiness(businesses.find(x=>String(x.id)===edit.dataset.editBusiness));
    if(toggle){const b=businesses.find(x=>String(x.id)===toggle.dataset.toggleBusiness);if(!b)return;const {error}=await client.from('business_directory').update({is_public:!b.is_public}).eq('id',b.id);if(error)showGlobal(error.message);else{showGlobal('Listing visibility updated.',true);await loadBusinesses();}}
    if(del){
      const b=businesses.find(x=>String(x.id)===del.dataset.deleteBusiness);
      if(!b||!confirm(`Delete "${b.business_name}" permanently?`))return;
      const {error}=await client.from('business_directory').delete().eq('id',b.id);
      if(error){showGlobal(error.message);return;}

      // If this listing came from an approved registration, reset that matching
      // registration to "new" so the admin status reflects that no directory
      // listing currently exists for it.
      const {data:matchingRegistrations,error:lookupError}=await client
        .from('network_registrations')
        .select('id')
        .eq('organization',b.business_name)
        .eq('city',b.city||'')
        .eq('status','approved');

      if(lookupError){
        showGlobal('Business deleted, but the related registration status could not be synced: '+lookupError.message);
        await Promise.all([loadBusinesses(),loadRegistrations()]);
        return;
      }
      if(matchingRegistrations && matchingRegistrations.length){
        const ids=matchingRegistrations.map(r=>r.id);
        const {error:statusError}=await client
          .from('network_registrations')
          .update({status:'new'})
          .in('id',ids);
        if(statusError){
          showGlobal('Business deleted, but the related registration status could not be reset: '+statusError.message);
          await Promise.all([loadBusinesses(),loadRegistrations()]);
          return;
        }
      }
      showGlobal('Business deleted. Related approved registration status reset to new.',true);
      await Promise.all([loadBusinesses(),loadRegistrations()]);
    }
  });
  $('registrationRows').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-registration]');
    const action=e.target.closest('[data-registration-status]');
    if(edit) {
      const record=registrations.find(x=>String(x.id)===edit.dataset.editRegistration);
      if(record) openRegistration(record);
    }
    if(action) {
      const id=action.dataset.registrationId;
      const status=action.dataset.registrationStatus;
      const record=registrations.find(x=>String(x.id)===id);
      if(!record)return;
      const verb=status==='approved'?'approve':'reject';
      if(!confirm(`Are you sure you want to ${verb} the registration from "${record.full_name}"?`))return;
      await setRegistrationStatus(id,status);
    }
  });
  $('refreshRegistrationsButton').addEventListener('click',loadRegistrations);
  $('refreshEnquiriesButton').addEventListener('click',loadEnquiries);
  $('enquiryRows').addEventListener('click',async e=>{
    const action=e.target.closest('[data-enquiry-status]');
    if(!action)return;
    const id=action.dataset.enquiryId, status=action.dataset.enquiryStatus;
    const record=enquiries.find(x=>String(x.id)===String(id));
    if(!record)return;
    if(!confirm(`Mark the enquiry from "${record.full_name}" as ${status}?`))return;
    await setEnquiryStatus(id,status);
  });
  $('registrationForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('registrationId').value;
    const record={
      full_name:$('registrationName').value.trim(),
      email:$('registrationEmail').value.trim(),
      phone:$('registrationPhone').value.trim(),
      organization:$('registrationOrganization').value.trim(),
      role:$('registrationRole').value.trim(),
      industry:$('registrationIndustry').value.trim(),
      city:$('registrationCity').value.trim(),
      website:$('registrationWebsite').value.trim()||null,
      interest:$('registrationInterest').value.trim(),
      details:$('registrationDetails').value.trim()||null,
      status:$('registrationStatus').value
    };
    const {error}=await client.from('network_registrations').update(record).eq('id',id);
    if(error){showGlobal('Could not save registration: '+error.message);return;}
    $('registrationForm').hidden=true;
    showGlobal('Registration updated successfully.',true);
    await loadRegistrations();
  });
  $('teamRows').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-team]'), toggle=e.target.closest('[data-toggle-team]'), del=e.target.closest('[data-delete-team]');
    if(edit) openTeam(team.find(x=>String(x.id)===edit.dataset.editTeam));
    if(toggle){const t=team.find(x=>String(x.id)===toggle.dataset.toggleTeam);if(!t)return;const {error}=await client.from('team_advisory').update({is_active:!t.is_active}).eq('id',t.id);if(error)showGlobal(error.message);else{showGlobal('Team visibility updated.',true);await loadTeam();}}
    if(del){const t=team.find(x=>String(x.id)===del.dataset.deleteTeam);if(!t||!confirm(`Delete "${t.full_name}" permanently?`))return;const {error}=await client.from('team_advisory').delete().eq('id',t.id);if(error)showGlobal(error.message);else{showGlobal('Team member deleted.',true);await loadTeam();}}
  });
  $('businessForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('businessId').value;
    const record={business_name:$('businessName').value.trim(),description:$('businessDescription').value.trim(),city:$('businessCity').value.trim(),state:$('businessState').value.trim(),country:$('businessCountry').value.trim(),business_segment:$('businessSegment').value.trim(),products:$('businessProducts').value.trim(),services:$('businessServices').value.trim(),website:$('businessWebsite').value.trim(),is_public:$('businessPublic').checked};
    const result=id?await client.from('business_directory').update(record).eq('id',id):await client.from('business_directory').insert(record);
    if(result.error){showGlobal(result.error.message);return;}
    $('businessForm').hidden=true;showGlobal('Business saved successfully.',true);await loadBusinesses();
  });
  $('teamForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('teamId').value; let photo_url=null, photo_path=currentPhotoPath;
    const file=$('teamPhoto').files[0];
    if(file){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)){showGlobal('Choose a JPG, PNG or WebP image.');return;}
      if(file.size>5*1024*1024){showGlobal('Photo must be 5 MB or smaller.');return;}
      const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const path=`${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await client.storage.from('team-photos').upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError){showGlobal(`Photo upload failed: ${uploadError.message}`);return;}
      photo_path=path;
      const {data}=client.storage.from('team-photos').getPublicUrl(path);
      photo_url=data.publicUrl;
    } else {
      const old=team.find(x=>String(x.id)===id);
      photo_url=old?.photo_url||null;
    }
    const record={full_name:$('teamName').value.trim(),role:$('teamRole').value.trim(),city_region:$('teamCity').value.trim(),bio:$('teamBio').value.trim(),sort_order:Number($('teamSort').value)||0,is_active:$('teamActive').checked,photo_path,photo_url};
    const result=id?await client.from('team_advisory').update(record).eq('id',id):await client.from('team_advisory').insert(record);
    if(result.error){showGlobal(result.error.message);return;}
    $('teamForm').hidden=true;showGlobal('Team member saved successfully.',true);await loadTeam();
  });
  function filterAdminRows(inputId, rowsId, buttonId, clearId) {
    const input = $(inputId);
    const rows = $(rowsId);
    const searchButton = $(buttonId);
    const clearButton = $(clearId);
    if (!input || !rows) return;

    const applyFilter = () => {
      const query = input.value.trim().toLocaleLowerCase();
      let visibleCount = 0;
      Array.from(rows.querySelectorAll('tr')).forEach(row => {
        const isMatch = !query || row.textContent.toLocaleLowerCase().includes(query);
        row.hidden = !isMatch;
        if (isMatch) visibleCount += 1;
      });
      rows.dataset.searchActive = query ? 'true' : 'false';
      rows.dataset.visibleCount = String(visibleCount);
    };
    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); applyFilter(); }
    });
    if (searchButton) searchButton.addEventListener('click', applyFilter);
    if (clearButton) clearButton.addEventListener('click', () => {
      input.value = '';
      applyFilter();
      input.focus();
    });
    applyFilter();
  }
  filterAdminRows('businessSearch', 'businessRows', 'businessSearchButton', 'businessSearchClear');
  filterAdminRows('teamSearch', 'teamRows', 'teamSearchButton', 'teamSearchClear');

  (async()=>{
    const {data}=await client.auth.getSession();
    if(data.session){
      try{await requireAdmin(data.session.user);setLoggedIn(data.session.user);await refreshAll();}
      catch(e){await client.auth.signOut();showLoginMessage(e.message||'Admin access denied.');}
    }
  })();
})();
