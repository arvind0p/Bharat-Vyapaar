(() => {
  if (!window.supabase || !window.BV_SUPABASE_URL || !window.BV_SUPABASE_ANON_KEY) return;
  const grid=document.getElementById('teamGrid');
  if(!grid)return;
  const client=window.supabase.createClient(window.BV_SUPABASE_URL,window.BV_SUPABASE_ANON_KEY);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  client.from('team_advisory').select('id,full_name,role,city_region,bio,photo_url,sort_order').eq('is_active',true).order('sort_order').order('full_name').then(({data,error})=>{
    if(error||!data||!data.length)return; // Keep current static content if the table is not configured yet.
    grid.innerHTML=data.map(t=>{
      const initials=t.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase();
      const avatar=t.photo_url?`<img class="team-photo" src="${esc(t.photo_url)}" alt="${esc(t.full_name)}" loading="lazy">`:`<div class="avatar">${esc(initials)}</div>`;
      return `<article class="person">${avatar}<h3>${esc(t.full_name)}</h3><p>${esc(t.role||'Core Team Member')}</p><p class="city">${esc(t.city_region||'')}</p>${t.bio?`<p class="team-bio">${esc(t.bio)}</p>`:''}</article>`;
    }).join('');
    const search=document.querySelector('.search');
    if(search)search.addEventListener('input',()=>{const q=search.value.toLowerCase();grid.querySelectorAll('.person').forEach(p=>p.style.display=p.textContent.toLowerCase().includes(q)?'':'none');});
  });
})();
