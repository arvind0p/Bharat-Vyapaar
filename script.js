
const menu=document.querySelector('.menu'),links=document.querySelector('.links');
if(menu&&links)menu.addEventListener('click',()=>links.classList.toggle('open'));
const file=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('.links a').forEach(a=>{if(a.getAttribute('href')===file)a.classList.add('active')});
document.querySelectorAll('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());
const search=document.querySelector('.search');
if(search)search.addEventListener('input',()=>{let q=search.value.toLowerCase();document.querySelectorAll('.person').forEach(p=>p.style.display=p.textContent.toLowerCase().includes(q)?'':'none')});
document.querySelectorAll('form[data-demo]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let s=f.querySelector('.status');if(s)s.textContent='Demo only: connect a backend or form service to receive submissions.';f.reset()}));
