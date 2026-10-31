(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const state={kind:params.get("type")==="team"?"team":"player",a:params.get("a")||"",b:""};
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt=value=>value==null||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString(undefined,{maximumFractionDigits:1});
  const bucket=id=>String(id).trim().toLowerCase().replace(/[^a-z0-9]/g,"_")[0]||"_";
  const normalize=id=>String(id||"").trim().toLowerCase();
  const dataPath=()=>state.kind==="team"?"teams":"players";
  async function load(path){const response=await fetch(path,{cache:"no-cache"});if(!response.ok)throw new Error("Could not load "+path+" ("+response.status+")");return response.json();}
  async function loadCompetitor(id){
    const key=normalize(id);if(!key)throw new Error("Please enter both competitor IDs.");
    const kind=dataPath();
    const index=await load("./data/profiles/index/"+kind+"-"+bucket(key)+".json");
    const entry=index[key];if(!entry)throw new Error("No "+state.kind+" profile found for “"+id+"”. Check the exact ID.");
    const shard=await load("./data/"+entry.profile_file);
    const profile=shard&&shard[entry.profile_key];
    if(!profile||!Array.isArray(profile.history))throw new Error("Detailed battle history is unavailable for "+id+".");
    return {entry,history:profile.history,name:state.kind==="team"?(entry.team_name||entry.name||id):(entry.username||entry.name||id),id:key};
  }
  function piCard(comp){
    const row=comp.entry;
    if(row.performance_index==null)return '<article class="compare-pi-card"><h3>'+esc(comp.name)+'</h3><strong>—</strong><small>PI not available yet</small><p>Refresh the published statistics to calculate the index.</p></article>';
    const eligible=Boolean(row.performance_index_eligible)&&row.performance_index_rank!=null;
    return '<article class="compare-pi-card"><h3>'+esc(comp.name)+'</h3><strong>'+fmt(row.performance_index)+'</strong><small>Performance Index · '+(eligible?"Rank #"+esc(row.performance_index_rank):"Provisional")+'</small><p>'+esc(row.performance_index_battles||0)+' valid ranked battle results</p></article>';
  }
  function render(a,b){
    const summary=window.UBTCompareCore.compareHistories(a.history,b.history);
    const {common,winsA,winsB,draws,pointsA,pointsB,rankWinsA,rankWinsB}=summary;
    $("compare-identities").innerHTML=[a,b].map(comp=>{
      const url=state.kind==="team"?"https://lichess.org/team/":"https://lichess.org/@/";
      return '<article class="compare-identity"><strong>'+esc(comp.name)+'</strong><span>'+esc(state.kind==="team"?"Team":"Player")+' · '+esc(comp.id)+'</span><a href="./profile.html?type='+state.kind+'&id='+encodeURIComponent(comp.id)+'">Open statistics profile ↗</a> · <a href="'+url+encodeURIComponent(comp.id)+'" target="_blank" rel="noopener noreferrer">Lichess ↗</a></article>';
    }).join("");
    $("compare-summary").innerHTML=[
      ["Shared battles",common.length],
      [a.name+" battle wins",winsA],
      [b.name+" battle wins",winsB],
      ["Draws",draws]
    ].map(([label,value])=>'<article class="compare-metric"><span>'+esc(label)+'</span><strong>'+fmt(value)+'</strong></article>').join("");
    $("compare-pi").innerHTML=piCard(a)+piCard(b);
    $("compare-name-a").textContent=a.name;$("compare-name-b").textContent=b.name;
    $("shared-count").textContent=common.length+" shared";
    $("shared-battles").innerHTML=common.length?common.slice(0,100).map(row=>{
      const sa=row.a.score==null?NaN:Number(row.a.score),sb=row.b.score==null?NaN:Number(row.b.score);
      const result=!Number.isFinite(sa)||!Number.isFinite(sb)
        ?'<span class="compare-draw">Score unavailable</span>'
        :sa>sb?'<span class="compare-result-a">'+esc(a.name)+' won</span>':sb>sa?'<span class="compare-result-b">'+esc(b.name)+' won</span>':'<span class="compare-draw">Draw</span>';
      const battle=String(row.a.name||row.b.name||"ULTRAbullet Team Battle");
      const link=row.a.id?"https://lichess.org/tournament/"+encodeURIComponent(row.a.id):"#";
      const date=row.a.startsAt?new Date(Number(row.a.startsAt)).toLocaleDateString():"—";
      return '<tr><td><a href="'+link+'" target="_blank" rel="noopener noreferrer">'+esc(battle)+'</a></td><td>'+esc(date)+'</td><td>'+fmt(sa)+' · #'+fmt(row.a.rank)+'</td><td>'+fmt(sb)+' · #'+fmt(row.b.rank)+'</td><td>'+result+'</td></tr>';
    }).join(""):'<tr><td colspan="5" class="compare-message">No shared battle results were found for these two competitors.</td></tr>';
    $("compare-results").classList.remove("hidden");
    $("compare-message").textContent="Comparison complete · "+common.length+" shared battle(s) found. Score totals: "+fmt(pointsA)+" vs "+fmt(pointsB)+" from "+summary.comparableScoreBattles+" comparable battles. Placement advantages: "+rankWinsA+" vs "+rankWinsB+" from "+summary.comparableRankBattles+" battles with both ranks available.";
  }
  async function compare(){
    $("compare-message").textContent="Loading profiles and matching battle histories…";
    $("compare-results").classList.add("hidden");
    try{
      const aId=$("compare-a").value.trim(),bId=$("compare-b").value.trim();
      if(normalize(aId)===normalize(bId))throw new Error("Choose two different competitors.");
      const [a,b]=await Promise.all([loadCompetitor(aId),loadCompetitor(bId)]);
      render(a,b);
    }catch(error){$("compare-message").textContent=error.message||"Comparison could not be loaded.";}
  }
  document.querySelectorAll("[data-kind]").forEach(button=>button.addEventListener("click",()=>{
    state.kind=button.dataset.kind;
    document.querySelectorAll("[data-kind]").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));});
    $("compare-results").classList.add("hidden");
    $("compare-message").textContent="Competitor type changed. Enter two "+(state.kind==="team"?"team IDs":"Lichess usernames")+".";
  }));
  document.querySelectorAll("[data-kind]").forEach(item=>{
    const active=item.dataset.kind===state.kind;
    item.classList.toggle("active",active);
    item.setAttribute("aria-pressed",String(active));
  });
  $("compare-a").value=state.a;
  $("compare-form").addEventListener("submit",event=>{event.preventDefault();compare();});
  if(state.a){$("compare-message").textContent="First competitor prefilled. Enter the second competitor."; $("compare-b").focus();}
})();
