(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const state={all:[],query:"",sort:"contribution_points",page:1,pageSize:50};
  const number=value=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:1});
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const initialLetter=value=>{const text=String(value??"").trim();const match=text.match(/[\p{L}\p{N}]/u);return (match?match[0]:Array.from(text)[0]||"?").toUpperCase();};
  const formatDate=value=>{
    if(value===null||value===undefined||value==="")return "—";
    const date=new Date(Number(value));
    return Number.isNaN(date.getTime())?"—":date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
  };
  const playerProfileUrl=id=>"./profile.html?type=player&id="+encodeURIComponent(String(id||""));
  const teamProfileUrl=id=>"./profile.html?type=team&id="+encodeURIComponent(String(id||""));
  function playerLink(row){
    const name=escapeHtml(row.name||row.lichess_id||"Unknown player");
    if(row.profile_available&&row.player_id)return '<a class="contributor-player-name" href="'+escapeHtml(playerProfileUrl(row.player_id))+'">'+name+'</a>';
    if(row.lichess_id)return '<a class="contributor-player-name" href="https://lichess.org/@/'+encodeURIComponent(String(row.lichess_id))+'" target="_blank" rel="noopener noreferrer">'+name+'</a>';
    return '<span class="contributor-player-name">'+name+'</span>';
  }
  function renderSummary(summary){
    $("summary-contributors").textContent=number(summary.contributors_count);
    $("summary-points").textContent=number(summary.total_contribution_points);
    $("summary-appearances").textContent=number(summary.battle_appearances_count);
    $("summary-teams").textContent=number(summary.teams_covered_count);
  }
  function renderPodium(){
    const rows=state.all.slice(0,3);
    if(!rows.length){$("contributors-podium").innerHTML='<div class="contributors-empty">No contributor records are available in this data snapshot.</div>';return;}
    $("contributors-podium").innerHTML=rows.map((row,index)=>
      '<article class="contributor-podium-card"><span class="contributor-podium-rank">#'+(index+1)+' · '+(index===0?"LEADER":index===1?"RUNNER-UP":"THIRD PLACE")+'</span>'+
      playerLink(row)+'<strong class="contributor-podium-points">'+number(row.contribution_points)+'</strong>'+
      '<span class="contributor-podium-label">listed contribution points</span>'+
      '<div class="contributor-podium-meta"><span>'+number(row.battles_listed)+' battles</span><span>'+number(row.teams_count)+' teams</span></div></article>'
    ).join("");
  }
  function sortedRows(){
    const query=state.query.trim().toLocaleLowerCase();
    const rows=state.all.filter(row=>!query
      ||String(row.name||"").toLocaleLowerCase().includes(query)
      ||String(row.lichess_id||"").toLocaleLowerCase().includes(query)
      ||(row.teams||[]).some(team=>String(team.name||"").toLocaleLowerCase().includes(query)));
    rows.sort((a,b)=>{
      const delta=(Number(b[state.sort])||0)-(Number(a[state.sort])||0);
      return delta||(Number(b.contribution_points)||0)-(Number(a.contribution_points)||0)
        ||(Number(b.battles_listed)||0)-(Number(a.battles_listed)||0)
        ||String(a.name||"").localeCompare(String(b.name||""));
    });
    return rows;
  }
  function renderRows(){
    const rows=sortedRows(),pages=Math.max(1,Math.ceil(rows.length/state.pageSize));
    state.page=Math.min(Math.max(1,state.page),pages);
    const start=(state.page-1)*state.pageSize,pageRows=rows.slice(start,start+state.pageSize);
    $("contributors-count").textContent=number(rows.length)+" entries";
    $("contributors-range").textContent=rows.length?"Showing "+number(start+1)+"–"+number(Math.min(start+pageRows.length,rows.length))+" of "+number(rows.length)+" contributors":"No contributors match this search.";
    $("contributors-page").textContent="Page "+state.page+" of "+pages;
    $("contributors-prev").disabled=state.page<=1;$("contributors-next").disabled=state.page>=pages;
    if(!pageRows.length){$("contributors-rows").innerHTML='<tr><td colspan="7" class="contributors-empty">No contributors match your search. Try a different player or team name.</td></tr>';return;}
    $("contributors-rows").innerHTML=pageRows.map(row=>{
      const teamRows=(row.teams||[]).map(team=>'<li><a href="'+escapeHtml(teamProfileUrl(team.id))+'">'+escapeHtml(team.name||team.id)+'</a><span>'+number(team.contribution_points)+' pts</span></li>').join("");
      const teamCell='<details class="contributor-team-details"><summary>'+number(row.teams_count)+' teams</summary><ul>'+teamRows+'</ul></details>';
      const avatar=escapeHtml(initialLetter(row.name));
      return '<tr><td class="contributor-rank '+(row.rank<=3?"top":"")+'">#'+number(row.rank)+'</td>'+
        '<td><div class="contributor-player"><span class="contributor-player-mark">'+avatar+'</span><div>'+playerLink(row)+'<small class="contributor-player-note">'+(row.profile_available?"Open contributor profile":"Open Lichess profile")+'</small></div></div></td>'+
        '<td class="numeric">'+number(row.contribution_points)+'</td><td class="numeric">'+number(row.battles_listed)+'</td>'+
        '<td class="numeric">'+teamCell+'</td><td class="numeric">'+number(row.avg_contribution)+'</td><td>'+formatDate(row.last_seen)+'</td></tr>';
    }).join("");
  }
  function showError(error){
    console.error("Contributor leaderboard could not be loaded:",error);
    $("contributors-updated").textContent="CONTRIBUTOR DATA NOT PUBLISHED";
    $("contributors-podium").innerHTML='<div class="contributors-error">The contributor index has not been generated yet. Run the <a href="https://github.com/belive-in-jesus/ULTRAbullet-Teambattles-Website-/actions/workflows/leaderboard.yml" target="_blank" rel="noopener noreferrer">Leaderboard data workflow</a> once after this update, then reload this page.</div>';
    $("contributors-rows").innerHTML='<tr><td colspan="7" class="contributors-error">The global contributor index is not available yet. The next successful full data refresh will publish it.</td></tr>';
    $("contributors-range").textContent="Contributor index unavailable";$("contributors-count").textContent="— entries";
  }
  async function init(){
    try{
      const response=await fetch("./data/contributors.json",{cache:"no-cache"});
      if(!response.ok)throw new Error("Could not load contributor index ("+response.status+").");
      const payload=await response.json();
      state.all=Array.isArray(payload.contributors)?payload.contributors:[];
      renderSummary(payload.summary||{});renderPodium();
      const updated=payload.generated_at?new Date(payload.generated_at):null;
      $("contributors-updated").textContent=updated&&!Number.isNaN(updated.getTime())?"UPDATED "+updated.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}):"CONTRIBUTOR ARCHIVE";
      renderRows();
    }catch(error){showError(error);}
  }
  $("contributor-search").addEventListener("input",event=>{state.query=event.target.value;state.page=1;renderRows();});
  $("contributor-sort").addEventListener("change",event=>{state.sort=event.target.value;state.page=1;renderRows();});
  $("contributor-page-size").addEventListener("change",event=>{state.pageSize=Math.max(1,Number(event.target.value)||50);state.page=1;renderRows();});
  $("contributors-prev").addEventListener("click",()=>{state.page=Math.max(1,state.page-1);renderRows();});
  $("contributors-next").addEventListener("click",()=>{state.page++;renderRows();});
  init();
})();
