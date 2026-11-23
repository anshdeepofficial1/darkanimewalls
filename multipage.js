/*
 Dark Anime Walls — shared public-site runtime.
 Source of truth: the existing /api/wallpapers endpoint; never fake catalog data.
 Navigation, search, previews, downloads, and form interactions work across pages.
 Motion: Unslop / Damir Sokolovsky, CC BY 4.0, https://github.com/heydamir/unslop
*/
(() => {
"use strict";
const page = document.body.dataset.page || "";
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const container = document.querySelector(".container");
const menu = document.getElementById("primaryNav");
const menuButton = document.getElementById("menuButton");
const progress = document.querySelector(".scroll-indicator span");
const dialog = document.getElementById("wallpaperDialog");
const listing = document.getElementById("wallpaperGrid");
const status = document.getElementById("wallpaperStatus");
const pager = document.getElementById("wallpaperPager");
const pageSize = page === "home" ? 6 : 12;
const cardsPerPage = page === "explore" ? 9 : pageSize;
const search = document.getElementById("wallpaperSearch");
const sort = document.getElementById("wallpaperSort");
const pills = document.getElementById("wallpaperFilters");
const toast = document.getElementById("siteToast");
let wallpapers = [];
let currentFilter = "All";
let currentPage = 1;
let active = null;
let restoreFocus = null;
let closeTimer = 0;
let spotlight = 0;
let catalogState = "loading";
let raf = 0;
const $ = id => document.getElementById(id);
const smooth = () => reduce.matches ? "auto" : "smooth";
const isDesktop = w => /desktop/i.test(String(w.type || "")) || Number(w.width) > Number(w.height);
const isMobile = w => /mobile/i.test(String(w.type || "")) || Number(w.height) > Number(w.width);
// Optimized display assets are never used for original-quality downloads.
const displayUrl = (w, width=640) => {
  try {
    const url=new URL(w.imageUrl);
    if(url.protocol!=="https:" || url.hostname!=="res.cloudinary.com" || !url.pathname.includes("/image/upload/"))return w.imageUrl;
    const transform="c_limit,w_"+Math.min(1200,Math.max(320,Math.round(width)))+"/q_auto:good/f_auto";
    url.pathname=url.pathname.replace("/image/upload/","/image/upload/"+transform+"/");
    return url.toString();
  } catch {return w.imageUrl}
};
const fileUrl = w => "/api/download?url=" + encodeURIComponent(w.downloadUrl || w.imageUrl || "")
  + "&name=" + encodeURIComponent(w.downloadName || "wallpaper");
const safe = s => String(s == null ? "" : s);
const animateOnce = () => {
  if (!("IntersectionObserver" in window) || reduce.matches) return;
  const ob = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("entered");
    ob.unobserve(entry.target);
  }), { threshold: .08, rootMargin: "0px 0px -14px 0px" });
  document.body.classList.add("motion-ready");
  document.querySelectorAll(".motion-reveal").forEach(el => ob.observe(el));
  window.revealWallpaperCards = () => {
    document.querySelectorAll(".art-card:not(.observed)").forEach((el, i) => {
      el.classList.add("observed");
      el.style.setProperty("--stagger", Math.min(i, 5) * 45 + "ms");
      ob.observe(el);
    });
  };
};
animateOnce();
if (menu && menuButton) {
  const setOpen = open => {
    menu.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  menuButton.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
  document.addEventListener("click", event => {
    if (menu.classList.contains("open") && !menu.contains(event.target) && !menuButton.contains(event.target)) setOpen(false);
  });
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));
  window.addEventListener("resize", () => { if (innerWidth > 790) setOpen(false); }, { passive:true });
  document.addEventListener("keydown", event => { if (event.key === "Escape") setOpen(false); });
}
const drawScroll = () => {
  raf = 0;
  document.body.classList.toggle("scrolled", window.scrollY > 24);
  if (!progress) return;
  const length = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  progress.style.transform = "scaleX(" + (length ? (window.scrollY / length).toFixed(4) : "0") + ")";
};
const requestScroll = () => { if (!raf) raf = requestAnimationFrame(drawScroll); };
window.addEventListener("scroll", requestScroll, { passive: true });
window.addEventListener("resize", requestScroll, { passive: true });
window.addEventListener("pageshow", requestScroll);
requestScroll();
function announce(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => toast.classList.remove("show"), 2100);
}
const make = (tag, attrs={}, text) => {
  const el = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (key === "class") el.className = value;
    else el.setAttribute(key, value);
  }
  if (text !== undefined) el.textContent = safe(text);
  return el;
};
function createCard(w, i=0) {
  const article = make("article", { class:"art-card", "data-format":isDesktop(w)?"desktop":"mobile" });
  const imageBtn = make("button", { class:"card-image", type:"button", "aria-label":"Preview " + safe(w.title || "wallpaper") });
  const img = make("img", {
    src:displayUrl(w, isDesktop(w) ? 720 : 540), alt:(w.title || "Dark anime") + (isDesktop(w) ? " desktop wallpaper" : " phone wallpaper"),
    loading:i < 2 && page === "home" ? "eager" : "lazy", decoding:"async",
    width:safe(w.width || 1080), height:safe(w.height || 1920)
  });
  imageBtn.append(img);
  imageBtn.addEventListener("click", () => openPreview(w));
  const details = make("div", { class:"card-body" });
  const tags = make("div", { class:"card-tags" });
  tags.append(make("span", {}, w.category || "Dark Anime"),make("span", {}, w.resolution || w.type || "Wallpaper"));
  const title = make("h3", {}, w.title || "Untitled wallpaper");
  const sub = make("p", {}, w.type || "Wallpaper");
  const actions = make("div", { class:"card-actions" });
  const preview = make("button", { class:"small-button", type:"button" }, "Preview");
  preview.addEventListener("click", () => openPreview(w));
  const download = make("a", { class:"small-button download", href:fileUrl(w), download:"" }, "Download");
  actions.append(preview, download);
  details.append(tags,title,sub,actions);
  article.append(imageBtn,details);
  return article;
}
const matches = w => {
  if (page === "phone" && !isMobile(w)) return false;
  if (page === "desktop" && !isDesktop(w)) return false;
  return true;
};
function filteredWallpapers() {
  const query = (search?.value || "").trim().toLocaleLowerCase();
  const values = wallpapers.filter(matches).filter(w => {
    const text = [w.title,w.category,w.type,w.mood,w.description,...(w.tags||[]),...(w.extraTags||[])].join(" ").toLocaleLowerCase();
    const category = [w.category,w.mood,...(w.extraTags||[])].join(" ").toLocaleLowerCase();
    const filterOK = currentFilter === "All" ||
      (currentFilter === "Phone" && isMobile(w)) ||
      (currentFilter === "Desktop" && isDesktop(w)) ||
      (currentFilter !== "Phone" && currentFilter !== "Desktop" &&
         (category.includes(currentFilter.toLowerCase()) || category.includes(currentFilter.toLowerCase().replace(/\s+/g,"-"))));
    return filterOK && (!query || text.includes(query));
  });
  if (sort?.value === "az") values.sort((a,b)=>safe(a.title).localeCompare(safe(b.title)));
  else if (sort?.value === "oldest") values.sort((a,b)=>new Date(a.createdAt || 0)-new Date(b.createdAt || 0));
  else values.sort((a,b)=>new Date(b.createdAt || 0)-new Date(a.createdAt || 0));
  return values;
}
function renderPager(count) {
  if (!pager) return;
  const totalPages = Math.ceil(count / cardsPerPage);
  pager.replaceChildren();
  if (totalPages <= 1) return;
  pager.append(make("span",{class:"page-count"}, "Page " + currentPage + " of " + totalPages));
  const controls = make("div",{class:"pager-buttons"});
  const button=(name,p,extra="")=>{
    const btn=make("button",{type:"button",class:extra+(extra?" ":"")+(Number(p)===currentPage?"current":"")},name);
    btn.disabled=p<1 || p>totalPages || p===currentPage;
    if(p===currentPage)btn.setAttribute("aria-current","page");
    btn.addEventListener("click",()=>{currentPage=p;renderGallery();$("wallpaperResults")?.scrollIntoView({behavior:smooth(),block:"start"})});
    controls.append(btn);
  };
  button("Previous",currentPage-1);
  const visible=[...new Set([1,totalPages,currentPage-1,currentPage,currentPage+1])]
    .filter(n=>n>=1&&n<=totalPages).sort((a,b)=>a-b);
  let prev=0;
  for(const n of visible){
    if(n>prev+1)controls.append(make("span",{class:"ellipsis","aria-hidden":"true"},"…"));
    button(String(n),n,"number");prev=n;
  }
  button("Next",currentPage+1);
  pager.append(controls);
}
function renderGallery() {
  if (!listing) return;
  const filtered=filteredWallpapers();
  const total=filtered.length;
  const max=Math.max(1,Math.ceil(total/cardsPerPage));
  currentPage=Math.min(currentPage,max);
  const offset=(currentPage-1)*cardsPerPage;
  const visible=filtered.slice(offset,offset+cardsPerPage);
  listing.replaceChildren(...visible.map(createCard));
  if (status) status.textContent=catalogState==="error"?"The gallery could not load. Please try again shortly.":
    !total?"No wallpapers match your search. Try another keyword or category.":
    "Showing "+(offset+1)+"–"+(offset+visible.length)+" of "+total+" wallpapers";
  $("wallpaperEmpty")?.toggleAttribute("hidden",total!==0);
  renderPager(total);
  window.revealWallpaperCards?.();
  requestScroll();
}
if (search) search.addEventListener("input",()=>{currentPage=1;renderGallery()});
if (sort) sort.addEventListener("change",()=>{currentPage=1;renderGallery()});
if (pills) pills.addEventListener("click",event=>{
  const chip=event.target.closest("[data-filter]");
  if(!chip)return;
  currentFilter=chip.dataset.filter;currentPage=1;
  pills.querySelectorAll("[data-filter]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn===chip)));
  renderGallery();
});
function openPreview(w) {
  if(!dialog || !w || !w.imageUrl)return;
  clearTimeout(closeTimer);
  dialog.classList.remove("is-closing");
  active=w;
  restoreFocus=document.activeElement;
  $("dialogArt").replaceChildren(make("img",{src:w.imageUrl,alt:(w.title||"Anime wallpaper")+" full preview",decoding:"async"}));
  $("dialogTitle").textContent=w.title||"Anime wallpaper";
  $("dialogDescription").textContent=w.description||"Dark anime wallpaper.";
  $("dialogMeta").textContent=[w.type,w.category,w.resolution].filter(Boolean).join(" · ");
  $("dialogDownload").href=fileUrl(w);
  dialog.classList.add("open");
  dialog.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  $("dialogClose").focus({preventScroll:true});
}
function finishClose(){
  dialog.classList.remove("open","is-closing");
  dialog.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});
  restoreFocus=null;
}
function closePreview(){
  if(!dialog?.classList.contains("open")||dialog.classList.contains("is-closing"))return;
  if(reduce.matches)finishClose();
  else{dialog.classList.add("is-closing");closeTimer=setTimeout(finishClose,160)}
}
if(dialog){
  $("dialogClose")?.addEventListener("click",closePreview);
  dialog.addEventListener("click",event=>{if(event.target===dialog)closePreview()});
  dialog.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.stopPropagation();closePreview();return}
    if(event.key!=="Tab")return;
    const focusables=Array.from(dialog.querySelectorAll("button:not([disabled]),a[href]"));
    if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
  });
  $("dialogCopy")?.addEventListener("click",async()=>{
    if(!active)return;
    const caption=(active.title||"Dark Anime")+" · "+(active.type||"wallpaper")+" · "+(active.resolution||"");
    try{await navigator.clipboard.writeText(caption);announce("Wallpaper details copied")}
    catch{announce("Copy is unavailable on this browser")}
  });
  $("dialogShare")?.addEventListener("click",async()=>{
    if(!active)return;
    const link=new URL("/explore.html",window.location.origin);
    link.searchParams.set("w",active.public_id);
    if(navigator.share){
      try{await navigator.share({title:active.title,text:"Dark Anime Walls wallpaper",url:link.toString()})}catch{}
    }else{
      try{await navigator.clipboard.writeText(link.toString());announce("Wallpaper link copied")}
      catch{announce("Sharing is unavailable on this browser")}
    }
  });
}
document.addEventListener("keydown",event=>{if(event.key==="Escape")closePreview()});
$("randomWallpaper")?.addEventListener("click",()=>{
  if(!wallpapers.length)return announce("No wallpapers are available yet");
  const options=wallpapers.filter(matches).filter(w=>w.public_id!==active?.public_id);
  const picks=options.length?options:wallpapers.filter(matches);
  if(!picks.length)return announce("No wallpapers in this collection yet");
  openPreview(picks[Math.floor(Math.random()*picks.length)]);
});
function renderHero() {
  const portrait=wallpapers.filter(isMobile).filter(w=>w.imageUrl);
  const landscape=wallpapers.filter(isDesktop).filter(w=>w.imageUrl);
  const total=Math.min(5,Math.max(portrait.length,landscape.length));
  const mobile=portrait[spotlight%portrait.length]||wallpapers[spotlight%wallpapers.length];
  const desktop=landscape[spotlight%landscape.length]||mobile;
  const poster=$("heroDesktopImage"),phone=$("heroMobileImage");
  if(poster&&desktop){
    poster.src=displayUrl(desktop, 1000);poster.alt=(desktop.title||"Dark anime")+" desktop wallpaper";
    $("heroDesktopTitle").textContent=desktop.title||"Widescreen wallpaper";
  }
  if(phone&&mobile){
    phone.src=displayUrl(mobile, 600);phone.alt=(mobile.title||"Dark anime")+" mobile wallpaper";
  }
  if($("spotlightCount"))$("spotlightCount").textContent=String(total?spotlight+1:0).padStart(2,"0")+" / "+String(total).padStart(2,"0");
  if($("spotlightNext"))$("spotlightNext").disabled=total<2;
}
$("spotlightNext")?.addEventListener("click",()=>{
  const p=wallpapers.filter(isMobile).filter(w=>w.imageUrl);
  const d=wallpapers.filter(isDesktop).filter(w=>w.imageUrl);
  const total=Math.min(5,Math.max(p.length,d.length));
  if(total<2)return;
  spotlight=(spotlight+1)%total;
  renderHero();
  const show=$("heroShowcase");
  if(show&&!reduce.matches){show.classList.remove("motion-change");void show.offsetWidth;show.classList.add("motion-change")}
});
function renderCategoryTiles(){
  const phone=wallpapers.find(w=>isMobile(w)&&w.imageUrl);
  const desktop=wallpapers.find(w=>isDesktop(w)&&w.imageUrl);
  if(phone&&$("tilePhone")){$("tilePhone").src=displayUrl(phone, 720);$("tilePhone").alt=""}
  if(desktop&&$("tileDesktop")){$("tileDesktop").src=displayUrl(desktop, 1000);$("tileDesktop").alt=""}
  if($("tilePhoneCount"))$("tilePhoneCount").textContent=wallpapers.filter(isMobile).length+" wallpapers";
  if($("tileDesktopCount"))$("tileDesktopCount").textContent=wallpapers.filter(isDesktop).length+" wallpapers";
}
async function loadCatalog(){
  if(!listing&&!$("heroShowcase")&&!$("tilePhone")&&!$("tileDesktop"))return;
  try{
    const response=await fetch("/api/wallpapers");
    if(!response.ok)throw new Error("Gallery unavailable");
    const data=await response.json();
    wallpapers=(Array.isArray(data.wallpapers)?data.wallpapers:[]).filter(w=>w.imageUrl && w.isPublished!==false);
    catalogState="ready";
    renderHero();renderCategoryTiles();renderGallery();
    if(page==="explore"){
      const requested=new URLSearchParams(location.search).get("w");
      if(requested){const item=wallpapers.find(w=>w.public_id===requested);if(item)openPreview(item)}
    }
  }catch(error){
    catalogState="error";
    if(status)status.textContent="The live wallpaper gallery is temporarily unavailable. Please try again later.";
    if($("wallpaperEmpty"))$("wallpaperEmpty").hidden=false;
    if($("heroDesktopTitle"))$("heroDesktopTitle").textContent="Gallery unavailable";
  }
}
loadCatalog();
const contactEmail="darkanimewalls@outlook.com";
function mailContact(subject,body){
  const u="https://outlook.live.com/mail/0/deeplink/compose?to="+encodeURIComponent(contactEmail)+"&subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  // Submit through the visitor's mail client—no request is stored by this site.
  const popup=window.open(u,"_blank");
  if(popup){try{popup.opener=null}catch{}}
  else window.location.href="mailto:"+contactEmail+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
}
$("requestForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const user=$("username").value.trim(),type=$("type").value,theme=$("theme").value.trim(),mood=$("mood").value,details=$("details").value.trim();
  const subject="Custom Wallpaper Request — Dark Anime Walls";
  const body="Instagram username: "+user+"\nFormat: "+type+"\nCharacter/theme: "+theme+"\nColor mood: "+mood+"\nDetails: "+(details||"Not specified");
  mailContact(subject,body);
});
$("contactForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const name=$("contactName").value.trim(),email=$("contactEmail").value.trim(),subject=$("contactTopic").value,body=$("contactMessage").value.trim();
  mailContact(subject+" — Dark Anime Walls","From: "+name+"\nReply-to: "+email+"\n\n"+body);
});
})();