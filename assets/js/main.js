const button=document.querySelector('.menu-button');
const nav=document.querySelector('.main-nav');
button?.addEventListener('click',()=>{
  const open=button.getAttribute('aria-expanded')==='true';
  button.setAttribute('aria-expanded',String(!open));
  nav.classList.toggle('open');
});
document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>{
  nav.classList.remove('open');button?.setAttribute('aria-expanded','false');
}));
document.getElementById('year').textContent=new Date().getFullYear();
