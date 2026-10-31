(()=>{"use strict";
const $=id=>document.getElementById(id);
const params=new URLSearchParams(window.location.search);
const type=params.get("type")==="team"?"team":"player";
const requestedId=(params.get("id")||"").trim();
const state={entry:null,history:[],periods:null,period:"all",specific:"",query:"",page:1,pageSize:25,filtered:[],chartRange:25};
const number=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1});
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate=v=>{if(v===null||v===undefined||v==="")return"Not available";const d=new Date(Number(v));return Number.isNaN(d.getTime())?"Not available":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});};
async function load(path){const response=await fetch(path,{cache:"no-cache"});if(!response.ok)throw new Error("Could not load "+path+" ("+response.status+")");return response.json();}
function profileBucket(id){return String(id).trim().toLowerCase().replace(/[^a-z0-9]/g,"_")[0]||"_";}
function leaderboardPath(){return type==="team"?"./data/leaderboard_teams.json":"./data/leaderboard_players.json";}
function idField(){return type==="team"?"team_id":"username";}
function normalizeId(id){return String(id||"").trim().toLowerCase();}
async function resolveEntry(){
  const key=normalizeId(requestedId);
  if(!key)return null;
  const bucket=profileBucket(key);
  try{
    const directory=await load("./data/profiles/index/"+(type==="team"?"teams":"players")+"-"+bucket+".json");
    if(directory&&directory[key])return directory[key];
  }catch(error){console.info("Profile directory not published yet; using compatibility lookup.",error);}
  const rows=await load(leaderboardPath());
  return Array.isArray(rows)?rows.find(row=>normalizeId(row[idField()])===key)||null:null;
}
function battleNumber(record){
  const match=String(record.name||"").match(/^\s*(\d+)(?:st|nd|rd|th)\s+ultrabullet\s+/i);
  return match?Number(match[1]):null;
}
function seasonNumber(record){const n=battleNumber(record);return n?Math.floor((n-1)/50)+1:null;}
function filteredHistoryForStats(){
  let rows=[...state.history];
  if(state.period==="month"&&state.specific)rows=rows.filter(record=>record.startsAt&&new Date(Number(record.startsAt)).toISOString().slice(0,7)===state.specific);
  else if(state.period==="season"&&state.specific)rows=rows.filter(record=>String(seasonNumber(record))===state.specific);
  else if(state.period.startsWith("last"))rows=rows.slice(0,Number(state.period.slice(4))||10);
  return rows;
}
function filteredHistory(){
  const query=state.query.trim().toLocaleLowerCase();
  return filteredHistoryForStats().filter(record=>!query||String(record.name||"").toLocaleLowerCase().includes(query));
}
function longestPodiumStreak(rows){
  const byBattle=new Map();
  rows.forEach(row=>{const n=battleNumber(row),rank=Number(row.rank);if(n&&Number.isFinite(rank))byBattle.set(n,rank);});
  if(!byBattle.size)return 0;
  let current=0,longest=0;
  for(let n=Math.min(...byBattle.keys());n<=Math.max(...byBattle.keys());n++){
    const rank=byBattle.get(n);
    if(rank!==undefined&&rank>=1&&rank<=3){current++;longest=Math.max(longest,current);}else current=0;
  }
  return longest;
}
function metrics(rows){
  const points=rows.reduce((sum,row)=>sum+(Number(row.score)||0),0);
  const ranks=rows.map(row=>Number(row.rank)).filter(value=>Number.isFinite(value)&&value>0);
  const podiums=ranks.filter(rank=>rank<=3).length;
  const best=rows.reduce((winner,row)=>(Number(row.score)||0)>(Number(winner?.score)||0)?row:winner,null);
  return {
    tournaments_played:rows.length,points,avg_points:rows.length?points/rows.length:0,
    best_tournament_score:best?Number(best.score)||0:0,
    first_places:ranks.filter(rank=>rank===1).length,podiums,
    top3_rate:ranks.length?podiums/ranks.length:0,
    best_finish:ranks.length?Math.min(...ranks):null,
    avg_finish:ranks.length?ranks.reduce((sum,value)=>sum+value,0)/ranks.length:null,
    active_since:rows.length?Math.min(...rows.map(row=>Number(row.startsAt)||Infinity)):null,
    longest_podium_streak:longestPodiumStreak(rows)
  };
}

const ACHIEVEMENT_LABELS={
  first_steps:{name:"Battle Regular",description:"Recorded results in 10 official battles.",icon:"10+"},
  battle_veteran:{name:type==="team"?"Veteran Team":"Battle Veteran",description:"Recorded results in 50 official battles.",icon:"50+"},
  century_club:{name:"Century Club",description:"Recorded results in 100 official battles.",icon:"100"},
  podium_finisher:{name:type==="team"?"Podium Team":"Podium Finisher",description:"Reached the top three at least five times.",icon:"TOP 3"},
  podium_collector:{name:type==="team"?"Podium Dynasty":"Podium Collector",description:"Reached the top three at least 25 times.",icon:"25×"},
  multi_champion:{name:type==="team"?"Championship Team":"Multiple Champion",description:"Won at least five official battles.",icon:"★"},
  podium_streak:{name:type==="team"?"Unbroken Form":"Podium Streak",description:"Reached the podium in five consecutive numbered battles.",icon:"STREAK"}
};
function renderAchievements(){
  const row=state.entry||{};
  const earned=[
    ["first_steps",Number(row.tournaments_played||0)>=10],
    ["battle_veteran",Number(row.tournaments_played||0)>=50],
    ["century_club",Number(row.tournaments_played||0)>=100],
    ["podium_finisher",Number(row.podiums||0)>=5],
    ["podium_collector",Number(row.podiums||0)>=25],
    ["multi_champion",Number(row.first_places||0)>=5],
    ["podium_streak",Number(row.longest_podium_streak||0)>=5]
  ].filter(([,qualified])=>qualified).map(([id])=>id);
  if(!earned.length){
    $("profile-achievements").innerHTML='<div class="profile-empty">No career badges earned yet. Achievement thresholds are calculated from this profile’s all-time record.</div>';
    return;
  }
  $("profile-achievements").innerHTML=earned.map(id=>{
    const item=ACHIEVEMENT_LABELS[id];
    if(!item)return "";
    return '<article class="achievement-badge-card"><span class="achievement-badge-icon">'+escapeHtml(item.icon)+'</span><span class="achievement-badge-copy"><strong>'+escapeHtml(item.name)+'</strong><small>'+escapeHtml(item.description)+'</small></span></article>';
  }).join("");
}
function renderMemberStatistics(profile){
  const isTeam=type==="team";
  $("member-stat-title").textContent=isTeam?"Top team contributors":"Recorded team affiliations";
  $("member-stat-description").textContent=isTeam
    ?"Players listed in this team's historical Lichess team-battle standings, with their recorded contributions."
    :"Teams in whose historical Lichess team-battle standings this player was listed, with the recorded contribution.";
  const rows=isTeam?(Array.isArray(profile.members)?profile.members:[]):(Array.isArray(profile.teams)?profile.teams:[]);
  const subject=isTeam?"Player":"Team";
  $("member-stat-head").innerHTML='<tr><th>'+subject+'</th><th class="number-cell">Battles listed</th><th class="number-cell">Contribution pts</th><th class="number-cell">Avg / battle</th><th>Last seen</th></tr>';
  if(!rows.length){
    $("member-stat-summary").textContent="No contributor snapshots are published for this profile yet.";
    $("member-stat-rows").innerHTML='<tr><td colspan="5" class="profile-empty">These statistics will be populated by the next successful full data refresh. Lichess exposes the players listed in each team standing; this is not a complete team roster.</td></tr>';
    return;
  }
  const total=rows.reduce((sum,row)=>sum+(Number(row.battles_listed)||0),0);
  $("member-stat-summary").textContent=rows.length+" "+(isTeam?"listed contributors":"recorded teams")+" · "+number(total)+" listed battle appearances";
  $("member-stat-rows").innerHTML=rows.map(row=>{
    const id=String(row.id||"");
    const href="./profile.html?type="+(isTeam?"player":"team")+"&id="+encodeURIComponent(id);
    return '<tr><td><a class="member-profile-link" href="'+escapeHtml(href)+'">'+escapeHtml(row.name||id)+'</a></td><td class="number-cell">'+number(row.battles_listed)+'</td><td class="number-cell">'+number(row.contribution_points)+'</td><td class="number-cell">'+number(row.avg_contribution)+'</td><td>'+escapeHtml(formatDate(row.last_seen))+'</td></tr>';
  }).join("");
}

function renderStats(){
  const m=metrics(filteredHistoryForStats());
  $("stat-points").textContent=number(m.points);
  $("stat-battles").textContent=number(m.tournaments_played);
  $("stat-average").textContent=number(m.avg_points);
  $("stat-podiums").textContent=number(m.podiums);
  $("stat-podium-caption").textContent=number(m.first_places)+" first places · top-three finishes";
  $("stat-points-caption").textContent=state.period==="all"?"Cumulative score":"Score in selected period";
  $("profile-period-caption").textContent=state.period==="all"?"All recorded battles":$("history-period").selectedOptions[0]?.textContent||"Selected period";
  const fields=[
    ["Best battle score",m.best_tournament_score??m.best_score,"Points"],
    ["Best finish",m.best_finish==null?"—":"#"+number(m.best_finish),"Highest recorded tournament finish"],
    ["Average finish",m.avg_finish==null?"—":"#"+number(m.avg_finish),"Across recorded finishes"],
    ["First places",m.first_places,"Tournament wins"],
    ["Podium rate",((Number(m.top3_rate)||0)*100).toFixed(1)+"%","Top-three finishes"],
    ["Longest podium streak",number(m.longest_podium_streak),"Consecutive numbered battles with a top-three finish"],
    ["Active since",formatDate(m.active_since),"First recorded result"]
  ];
  $("profile-records").innerHTML=fields.map(([label,value,caption])=>'<article class="profile-record"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value??"—")+'</strong><small>'+escapeHtml(caption)+'</small></article>').join("");
}
function renderChart(){
  const analytics=window.UBTAnalytics;
  if(!analytics){$("profile-chart").innerHTML='<div class="profile-empty">The analytics module could not be loaded.</div>';return;}
  const rows=analytics.chronological(filteredHistoryForStats());
  const limit=state.chartRange==="all"?null:Number(state.chartRange)||25;
  const visible=limit?rows.slice(-limit):rows;
  $("chart-range").textContent=visible.length?formatDate(visible[0].startsAt)+" – "+formatDate(visible[visible.length-1].startsAt):"No data";
  $("profile-chart").innerHTML=analytics.buildScoreTrendSvg(rows,limit);
}
function renderAnalytics(){
  const analytics=window.UBTAnalytics;
  if(!analytics)return;
  const rows=filteredHistoryForStats();
  const summary=analytics.summarize(rows);
  $("analytics-period-label").textContent=state.period==="all"?"ALL-TIME DATA":($("history-period").selectedOptions[0]?.textContent||"SELECTED PERIOD").toLocaleUpperCase();
  $("analytics-recent-average").textContent=summary.recentBattles?number(summary.recentAverage):"—";
  if(summary.recentBattles&&summary.avgPoints){
    const delta=summary.recentAverageDelta,verb=delta>0.005?"above":delta< -0.005?"below":"in line with";
    const prefix=delta>0?"+":"";
    $("analytics-average-delta").textContent=prefix+(delta*100).toFixed(1)+"% "+verb+" the selected-period average";
  }else $("analytics-average-delta").textContent="Not enough results for a comparison";
  $("analytics-recent-podium-rate").textContent=summary.recentRankedBattles?(summary.recentPodiumRate*100).toFixed(1)+"%":"—";
  $("analytics-recent-podium-caption").textContent=summary.recentRankedBattles?number(summary.recentPodiums)+" podiums from "+number(summary.recentRankedBattles)+" ranked battles":"No placement data in the latest results";
  $("analytics-latest-streak").textContent=summary.latestPodiumRun?number(summary.latestPodiumRun)+" battles":"—";
  $("analytics-ranked-count").textContent=number(summary.rankedBattles)+" ranked battles";
  $("analytics-donut").innerHTML=analytics.buildFinishDonutSvg(summary);
  const total=summary.rankedBattles;
  $("analytics-donut-legend").innerHTML=summary.rankCounts.map(item=>{
    const percentage=total?(item.count/total*100).toFixed(1)+"%":"0%";
    return '<div class="analytics-legend-row"><i style="--legend-color:'+item.color+'"></i><span>'+escapeHtml(item.label)+'</span><strong>'+number(item.count)+'</strong><small>'+percentage+'</small></div>';
  }).join("");
  $("analytics-monthly-chart").innerHTML=analytics.buildMonthlySvg(summary.months);
  $("analytics-monthly-summary").textContent=summary.bestMonth
    ?"Top month: "+summary.bestMonth.label+" · "+number(summary.bestMonth.points)+" points · "+number(summary.bestMonth.battles)+" battles"
    :"No monthly breakdown available";
  $("analytics-heatmap").innerHTML=analytics.buildActivityHeatmapSvg(rows);
  $("analytics-season-rows").innerHTML=analytics.buildSeasonRows(summary.seasons);
}
function renderHistory(){
  const rows=filteredHistory();state.filtered=rows;
  const total=rows.length,pageCount=Math.max(1,Math.ceil(total/state.pageSize));
  state.page=Math.max(1,Math.min(state.page,pageCount));
  const start=(state.page-1)*state.pageSize,visible=rows.slice(start,start+state.pageSize);
  $("history-summary").textContent=number(total)+" battles · "+(state.period==="all"?"all-time archive":$("history-period").selectedOptions[0]?.textContent||"selected period");
  $("history-page-summary").textContent=total?("Showing "+number(start+1)+"–"+number(Math.min(start+state.pageSize,total))+" of "+number(total)):"No battles found";
  $("history-page").textContent="Page "+state.page+" of "+pageCount;
  $("history-prev").disabled=state.page<=1;$("history-next").disabled=state.page>=pageCount;
  if(!visible.length){$("history-rows").innerHTML='<tr><td colspan="5" class="profile-empty">'+(state.history.length?"No battles match your search.":"No battle history is available for this competitor.")+'</td></tr>';return;}
  $("history-rows").innerHTML=visible.map(row=>{
    const n=battleNumber(row),href="https://lichess.org/tournament/"+encodeURIComponent(String(row.id||""));
    const finish=row.rank?("#"+number(row.rank)):"—";
    return '<tr><td><span class="battle-name">'+escapeHtml(row.name||"UltraBullet Team Battle")+'</span><span class="battle-number">'+(n?"Battle "+n:"Unnumbered battle")+'</span></td><td>'+escapeHtml(formatDate(row.startsAt))+'</td><td class="number-cell">'+escapeHtml(finish)+'</td><td class="number-cell">'+escapeHtml(number(row.score))+'</td><td><a href="'+href+'" target="_blank" rel="noopener noreferrer">Open ↗</a></td></tr>';
  }).join("");
}
function renderPeriodOptions(){
  const select=$("specific-period");select.innerHTML="";
  if(state.period==="month"){
    (state.periods?.months||[]).forEach(item=>{const option=document.createElement("option");option.value=item.key;option.textContent=item.label+" · "+number(item.battle_count)+" battles";select.appendChild(option);});
  }else if(state.period==="season"){
    (state.periods?.seasons||[]).forEach(item=>{const option=document.createElement("option");option.value=String(item.key).replace("season-","");option.textContent=item.label+(item.complete?"":" · in progress")+(item.missing_battle_numbers?.length?" · "+item.missing_battle_numbers.length+" missing":"");select.appendChild(option);});
  }
  if(select.options.length){state.specific=select.options[0].value;select.value=state.specific;$("specific-period-wrap").classList.remove("hidden");}
  else{$("specific-period-wrap").classList.add("hidden");state.specific="";}
}
function renderAll(){renderStats();renderChart();renderAnalytics();renderHistory();}
async function init(){
  if(!requestedId){$("profile-name").textContent="Profile not found";$("profile-description").textContent="This profile URL is missing its competitor identifier.";return;}
  $("profile-kind").textContent=type==="team"?"TEAM PROFILE":"PLAYER PROFILE";
  const entry=await resolveEntry();
  if(!entry){$("profile-name").textContent="Competitor not found";$("profile-description").textContent="No matching competitor exists in the published leaderboard data.";$("profile-records").innerHTML='<div class="profile-empty">Check the profile link or return to the leaderboard.</div>';return;}
  state.entry=entry;
  const canonicalId=entry[idField()]||entry.id||requestedId;
  const displayName=type==="team"?(entry.team_name||entry.name||canonicalId):(entry.username||entry.name||canonicalId);
  document.title=displayName+" — UltraBullet Team Battles";
  $("profile-name").textContent=displayName;
  $("profile-description").textContent=type==="team"?"Historical team performance across the numbered ULTRAbullet Team Battles.":"Individual performance across the numbered ULTRAbullet Team Battles.";
  $("profile-rank").textContent="#"+number(entry.rank);
  $("profile-rank-caption").textContent=type==="team"?"All-time team ranking":"All-time player ranking";
  $("profile-last-active").textContent=formatDate(entry.last_played);
  $("lichess-profile-link").href=type==="team"?"https://lichess.org/team/"+encodeURIComponent(canonicalId):"https://lichess.org/@/"+encodeURIComponent(canonicalId);
  $("share-profile").addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText(window.location.href);$("profile-feedback").textContent="Profile link copied to clipboard.";}
    catch(error){$("profile-feedback").textContent="Copy is unavailable in this browser. Copy the page address from the address bar.";}
  });
  const [shard,periods]=await Promise.all([load("./data/"+entry.profile_file),load("./data/periods_index.json").catch(()=>null)]);
  const profile=shard&&shard[entry.profile_key];
  if(!profile||!Array.isArray(profile.history))throw new Error("The competitor's detailed history is not present in the published profile shard.");
  state.history=[...profile.history].sort((a,b)=>(Number(b.startsAt)||0)-(Number(a.startsAt)||0));
  state.periods=periods;
  renderAchievements();
  renderMemberStatistics(profile);
  $("trend-range").addEventListener("change",()=>{state.chartRange=$("trend-range").value;renderChart();});
  $("history-period").addEventListener("change",()=>{
    state.period=$("history-period").value;state.page=1;
    if(state.period==="month"||state.period==="season")renderPeriodOptions();
    else{$("specific-period-wrap").classList.add("hidden");state.specific="";}
    renderAll();
  });
  $("specific-period").addEventListener("change",()=>{state.specific=$("specific-period").value;state.page=1;renderAll();});
  $("history-search").addEventListener("input",()=>{state.query=$("history-search").value;state.page=1;renderHistory();});
  $("history-prev").addEventListener("click",()=>{if(state.page>1){state.page--;renderHistory();}});
  $("history-next").addEventListener("click",()=>{if(state.page<Math.ceil(state.filtered.length/state.pageSize)){state.page++;renderHistory();}});
  renderAll();
}
init().catch(error=>{
  console.error("Could not load profile",error);
  $("profile-name").textContent="Profile temporarily unavailable";
  $("profile-description").textContent="The profile data could not be loaded. Please return to the leaderboard and try again.";
  $("profile-records").innerHTML='<div class="profile-empty">'+escapeHtml(error.message||"An unexpected error occurred.")+'</div>';
  $("history-rows").innerHTML='<tr><td colspan="5" class="profile-empty">Battle history could not be loaded.</td></tr>';
});
})();