(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const num=value=>Number(value||0).toLocaleString();
  async function load(){
    const response=await fetch("./data/achievements.json",{cache:"no-cache"});
    if(!response.ok)throw new Error("Achievement data is waiting for the next successful full data refresh.");
    return response.json();
  }
  function profileUrl(kind,id){
    return "./profile.html?type="+(kind==="teams"?"team":"player")+"&id="+encodeURIComponent(String(id||""));
  }
  function renderSummary(data){
    const s=data.summary||{};
    $("achievement-summary").innerHTML=[
      ["Player badges awarded",s.player_badges_awarded],
      ["Teams with badges",s.teams_with_achievements],
      ["Player profiles awarded",s.players_with_achievements],
      ["Team badges awarded",s.team_badges_awarded]
    ].map(([label,value])=>'<article class="achievement-summary-card"><span>'+esc(label)+'</span><strong>'+num(value)+'</strong></article>').join("");
  }
  function renderCategory(data,kind,target){
    const rows=data.categories?.[kind]||[];
    $(target).innerHTML=rows.map(item=>{
      const holders=(item.holders||[]).map(holder=>'<div class="achievement-holder"><a href="'+esc(profileUrl(kind,holder.id))+'">'+esc(holder.name||holder.id)+'</a><strong>'+num(holder.value)+'</strong></div>').join("");
      return '<article class="achievement-card"><div class="achievement-card-head"><span class="achievement-card-icon">'+esc(item.icon||"★")+'</span><div><h3>'+esc(item.name)+'</h3><span class="achievement-criteria">'+esc(item.criteria)+'</span></div></div><p>'+esc(item.description)+'</p><div class="achievement-card-footer"><span>'+num(item.count)+' awarded</span><span>Top holders</span></div><div class="achievement-holders">'+(holders||'<span class="achievement-holder">No holders yet</span>')+'</div></article>';
    }).join("")||'<div class="achievement-loading">No achievements are available yet.</div>';
  }
  function renderLeaders(data,kind,target){
    const rows=data.leaders?.[kind]||[];
    $(target).innerHTML=rows.map((row,index)=>'<div class="achievement-leader"><span>#'+(index+1)+'</span><a href="'+esc(profileUrl(kind,row.id))+'">'+esc(row.name||row.id)+'</a><strong>'+num(row.achievement_count)+' badges</strong></div>').join("")||'<p class="achievement-loading">No awarded badges yet.</p>';
  }
  load().then(data=>{
    renderSummary(data);
    renderCategory(data,"players","player-achievements");
    renderCategory(data,"teams","team-achievements");
    renderLeaders(data,"players","player-achievement-leaders");
    renderLeaders(data,"teams","team-achievement-leaders");
    $("achievement-updated").textContent=data.generated_at?"Achievement index refreshed "+new Date(data.generated_at).toLocaleString():"Achievement index refreshed with latest leaderboard data.";
  }).catch(error=>{
    console.error("Could not load achievement data",error);
    $("achievement-summary").innerHTML='<div class="achievement-loading">Waiting for the next successful full data refresh.</div>';
    $("player-achievements").innerHTML='<div class="achievement-loading">Achievement definitions and holder rankings will appear after the updated aggregation workflow runs.</div>';
    $("team-achievements").innerHTML='<div class="achievement-loading">Achievement definitions and holder rankings will appear after the updated aggregation workflow runs.</div>';
    $("player-achievement-leaders").innerHTML="";
    $("team-achievement-leaders").innerHTML="";
    $("achievement-updated").textContent=error.message||"Achievement data is not available yet.";
  });
})();