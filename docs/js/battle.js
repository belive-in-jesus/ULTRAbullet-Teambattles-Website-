"use strict";
(()=>{
const get=id=>document.getElementById(id);
const params=new URLSearchParams(window.location.search);
const battleId=(params.get("id")||"").trim();
const state={report:null,view:"teams",query:"",showAll:false};
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{maximumFractionDigits:1}):"—";
const initialLetter=value=>{const text=String(value??"").trim();const match=text.match(/[\p{L}\p{N}]/u);return (match?match[0]:Array.from(text)[0]||"?").toUpperCase();};
const date=v=>{const d=new Date(Number(v));return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):"Date not available";};
function status(message,error){const node=get("battle-status");node.textContent=message;node.classList.toggle("error",!!error);}
function showRows(){
 const rows=state.view==="teams"?state.report.teams:state.report.players;
 const query=state.query.trim().toLowerCase();
 const filtered=rows.filter(row=>String(row.name||row.id||"").toLowerCase().includes(query));
 const shown=state.showAll?filtered:filtered.slice(0,10);
 get("result-count").textContent=fmt(filtered.length)+(state.view==="teams"?" teams":" players");
 get("result-name-heading").textContent=state.view==="teams"?"Team":"Player";
 get("results-heading").textContent=state.view==="teams"?"Team standings":"Individual standings";
 get("results-description").textContent=state.view==="teams"?"Team places and scores recorded for this battle.":"Individual places and scores recorded for this battle.";
 get("results-more").hidden=filtered.length<=10;
 get("results-more").textContent=state.showAll?"Show fewer ↑":"Show all results ↓";
 const body=get("result-rows");body.replaceChildren();
 if(!shown.length){const row=document.createElement("tr");const cell=document.createElement("td");cell.colSpan=4;cell.className="battle-empty";cell.textContent=rows.length?"No results match your search.":"No standings were published for this category.";row.appendChild(cell);body.appendChild(row);return;}
 shown.forEach((item,index)=>{
  const row=document.createElement("tr");
  const rank=document.createElement("td");rank.className="rank-cell";rank.textContent="#"+fmt(Number(item.rank)>0?item.rank:index+1);row.appendChild(rank);
  const label=String(item.name||item.id||"Unknown");
  const name=document.createElement("td");name.className="result-name";
  const identity=document.createElement("div");identity.className="result-identity";
  const mark=document.createElement("span");mark.className="result-initial";mark.textContent=initialLetter(label);mark.setAttribute("aria-hidden","true");
  const copy=document.createElement("span");copy.className="result-name-text";copy.textContent=label;
  identity.appendChild(mark);identity.appendChild(copy);name.appendChild(identity);row.appendChild(name);
  const score=document.createElement("td");score.className="number-cell";score.textContent=fmt(item.score);row.appendChild(score);
  const profile=document.createElement("td");const link=document.createElement("a");link.className="result-profile";link.textContent="Profile ↗";link.href="./profile.html?type="+(state.view==="teams"?"team":"player")+"&id="+encodeURIComponent(item.id||"");profile.appendChild(link);row.appendChild(profile);
  body.appendChild(row);
 });
}
function selectView(view){state.view=view;state.showAll=false;state.query="";get("result-search").value="";get("view-teams").classList.toggle("active",view==="teams");get("view-players").classList.toggle("active",view==="players");get("view-teams").setAttribute("aria-pressed",String(view==="teams"));get("view-players").setAttribute("aria-pressed",String(view==="players"));get("result-search").placeholder=view==="teams"?"Find a team…":"Find a player…";showRows();}
async function init(){
 if(!/^[A-Za-z0-9_-]{4,20}$/.test(battleId)){get("battle-title").textContent="Battle not found";status("Please return to the battle archive and choose a listed tournament.",true);return;}
 const original="https://lichess.org/tournament/"+encodeURIComponent(battleId);get("battle-original-link").href=original;
 try{
  const response=await fetch("./data/battles/"+encodeURIComponent(battleId)+".json",{cache:"no-cache"});
  if(!response.ok)throw new Error(response.status===404?"not-published":"request-failed");
  const report=await response.json();
  if(!report||!report.battle||!Array.isArray(report.teams)||!Array.isArray(report.players))throw new Error("invalid-report");
  state.report=report;const battle=report.battle;
  get("battle-title").textContent=battle.name||"UltraBullet Team Battle";
  get("battle-subtitle").textContent="Battle "+fmt(battle.battle_number)+" · Results recorded in the UltraBullet Team Battles archive.";
  document.title=(battle.name||"Battle report")+" — UltraBullet Team Battles";
  get("battle-original-link").href=battle.url||original;
  get("battle-date").textContent=date(battle.startsAt);get("battle-participants").textContent=fmt(battle.nbPlayers);
  get("battle-results-count").textContent=fmt(report.teams.length)+" teams · "+fmt(report.players.length)+" players";
  get("battle-summary").hidden=false;
  if(!report.teams.length&&!report.players.length){status("The battle is in the archive, but detailed standings were not available in the latest data refresh.");return;}
  get("battle-results-panel").hidden=false;get("view-teams").hidden=!report.teams.length;get("view-players").hidden=!report.players.length;
  status("Detailed standings loaded. Select a team or player to open the corresponding profile.");selectView(report.teams.length?"teams":"players");
 }catch(error){
  get("battle-title").textContent="Battle report";
  get("battle-subtitle").textContent="Detailed standings for this tournament are not currently available.";
  const message=error.message==="not-published"?"The detailed report has not been published yet. It will appear after the next successful leaderboard data refresh. You can still open the original Lichess tournament.":error.message==="invalid-report"?"The published report has an unexpected format. Please check again after the next data refresh.":"The battle report could not be loaded. Please try again later or open the original Lichess tournament.";
  status(message,true);
 }
}
get("view-teams").addEventListener("click",()=>{if(state.report&&state.report.teams.length)selectView("teams");});
get("view-players").addEventListener("click",()=>{if(state.report&&state.report.players.length)selectView("players");});
get("result-search").addEventListener("input",()=>{state.query=get("result-search").value;state.showAll=false;if(state.report)showRows();});
get("results-more").addEventListener("click",()=>{state.showAll=!state.showAll;showRows();});
init();
})();