// Current, evidence-based trend research. Does NOT invent Google search volumes.
// Usage: node scripts/trend-research.mjs > today's research.json
const JIKAN="https://api.jikan.moe/v4";
async function getJson(url){
  const response=await fetch(url,{headers:{"User-Agent":"DarkAnimeWalls/1.0 (anime wallpaper research)"}});
  if(!response.ok) throw new Error("Research request failed "+response.status+": "+url);
  return response.json();
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function googleTrendingTitles(geo) {
  try {
    const response=await fetch("https://trends.google.com/trending/rss?geo="+geo);
    if(!response.ok) return [];
    const xml=await response.text();
    return [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi)]
      .map(x=>x[1].replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").trim()).filter(Boolean);
  }catch{return [];}
}
function score(entry,googleTitles) {
  const haystack=[entry.name,entry.anime].join(" ").toLowerCase();
  const google=googleTitles.filter(x=>haystack.includes(x.toLowerCase()) || x.toLowerCase().includes(entry.name.toLowerCase()));
  const interest=Math.log2(1+entry.animeMembers)*0.9+Math.log2(1+entry.favorites)*1.4;
  return {...entry,searchSignal:google,score:Number((interest+google.length*50).toFixed(2))};
}
const now=new Date();
const season=await getJson(JIKAN+"/seasons/now?filter=tv&limit=12");
const anime=(season.data||[]).filter(a=>a.airing&&a.mal_id&&a.members>0).slice(0,6);
if(!anime.length) throw new Error("No verifiable currently airing anime found; trend research stopped");
const googleTitles=[...new Set([...(await googleTrendingTitles("IN")),...(await googleTrendingTitles("US"))])];
const entries=[];
for(const a of anime){
  await sleep(450); // respect public Jikan rate limits
  const details=await getJson(JIKAN+"/anime/"+a.mal_id+"/characters");
  const characters=(details.data||[]).filter(x=>x.role==="Main" && x.character?.name).slice(0,15);
  for(const c of characters){
    entries.push({name:c.character.name,anime:a.title_english||a.title,animeMembers:a.members,
      favorites:c.favorites||0,animeUrl:a.url,characterUrl:c.character.url,seasonAiredFrom:a.aired?.from,
      animeId:a.mal_id,characterId:c.character.mal_id});
  }
}
if(!entries.length) throw new Error("No verified current characters returned by research sources");
let candidates=entries.map(x=>score(x,googleTitles)).sort((a,b)=>b.score-a.score);
const selected=candidates[0];
const result={
  researchedAt:now.toISOString(),selectedCharacter:selected.name,selectedAnime:selected.anime,
  confidence:selected.searchSignal.length?"google-trends-mention-and-airing-anime":"airing-anime-popularity-proxy-only",
  notVerified:"Jikan favorites and anime members are not Google search counts or Instagram audience insights.",
  searchSignalAvailability:googleTitles.length>0,googleTrendMentions:selected.searchSignal,
  candidates:candidates.slice(0,8),
  sources:["https://api.jikan.moe/v4/seasons/now?filter=tv&limit=12",selected.animeUrl,selected.characterUrl,
    "https://trends.google.com/trending/rss?geo=IN","https://trends.google.com/trending/rss?geo=US"]
};
process.stdout.write(JSON.stringify(result,null,2)+"\n");
