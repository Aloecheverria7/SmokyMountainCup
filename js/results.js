(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ticker=document.querySelector('#cup-ticker'), track=document.querySelector('#cup-ticker-track'), cards=document.querySelector('#cup-live-cards'), filter=document.querySelector('#cup-category-filter'), stale=document.querySelector('#cup-stale');
  const liveStates=['live','half_time','paused'];let data=null,inFlight=false,paused=false,hover=false,lastFrame=0,tickerPosition=0,tickerIDs='',liveIDs='',retryTimer=null;
  const status=m=>m.away==='BYE'?'Bye · advances':({scheduled:'Scheduled',live:'LIVE',half_time:'Half-time',paused:'Paused',finished:'Final',suspended:'Suspended'}[m.status]||m.status)+(liveStates.includes(m.status)?` · ${Math.floor(m.elapsed/60)}′`:'');
  const time=m=>m.scheduled_iso?new Intl.DateTimeFormat('en-US',{timeZone:m.timezone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(m.scheduled_iso)):'Time TBA';
  function today(m){const date=m.scheduled_iso||(m.status==='finished'?m.updated_at.replace(' ','T')+'Z':null);return date && new Intl.DateTimeFormat('en-CA',{timeZone:m.timezone}).format(new Date(date))===new Intl.DateTimeFormat('en-CA',{timeZone:m.timezone}).format(new Date());}
  function priority(matches){return [...matches].sort((a,b)=>{
    const rank=m=>liveStates.includes(m.status)?0:(today(m)&&m.status==='finished')?1:m.status==='scheduled'?2:m.status==='finished'?3:4;
    return rank(a)-rank(b) || (a.status==='finished'&&b.status==='finished'?String(b.updated_at).localeCompare(String(a.updated_at)):String(a.scheduled_at||'9999').localeCompare(String(b.scheduled_at||'9999'))) || Number(a.id)-Number(b.id);
  });}
  function card(m){return `<article class="cup-match-card" data-game-id="${m.id}"><a href="match.php?id=${m.id}"><small>${esc(m.category)}${m.group_name?' · '+esc(m.group_name):''}</small><p class="cup-badge ${m.status==='live'?'is-live':''}" data-game-status>${esc(status(m))}</p><div class="cup-team-row">${m.home_crest?`<img src="${esc(m.home_crest)}" alt="" loading="lazy" decoding="async">`:''}${esc(m.home)}<b data-home-score>${m.home_score}</b></div><div class="cup-team-row">${m.away_crest?`<img src="${esc(m.away_crest)}" alt="" loading="lazy" decoding="async">`:''}${esc(m.away)}<b data-away-score>${m.away_score}</b></div><div class="cup-card-footer"><span>${esc(m.field||'Field TBA')}</span><span>${esc(time(m))}</span></div></a></article>`;}
  function updateCards(matches){for(const m of matches){document.querySelectorAll(`[data-game-id="${m.id}"]`).forEach(el=>{
    const s=el.querySelector('[data-game-status]');if(s){s.textContent=status(m);s.classList.toggle('is-live',m.status==='live');}
    const hs=el.querySelector('[data-home-score]'),as=el.querySelector('[data-away-score]');if(hs)hs.textContent=m.home_score;if(as)as.textContent=m.away_score;
  });}}
  function renderLive(){
    if(!cards||!data)return;
    const selected=filter?.value||'',list=data.matches.filter(m=>!selected||String(m.category_id)===selected);
    const active=priority(list.filter(m=>liveStates.includes(m.status))),suspended=list.filter(m=>m.status==='suspended');
    const fallback=priority(list.filter(m=>m.status==='scheduled'||(m.status==='finished'&&today(m)))).slice(0,12);
    const shown=active.length?active:fallback;
    const title=document.querySelector('#cup-live-title');if(title)title.textContent=active.length?'Live now':'Around the tournament';
    const signature=JSON.stringify([selected,shown.map(m=>[m.id,m.home_entry_id,m.away_entry_id,m.field_id,m.scheduled_at]),suspended.map(m=>m.id)]);
    if(signature!==liveIDs){cards.innerHTML=shown.length?shown.map(card).join(''):'<p class="cup-empty">No games are scheduled yet. Check back for the next matchday.</p>';liveIDs=signature;}
    const suspendedRoot=document.querySelector('#cup-suspended');if(suspendedRoot){suspendedRoot.hidden=!suspended.length;suspendedRoot.innerHTML=suspended.length?'<h3>Suspended games</h3><div class="cup-match-grid">'+suspended.map(card).join('')+'</div>':'';}
    updateCards(list);
  }
  function renderTicker(){
    if(!track||!data)return;
    const list=priority(data.matches);ticker.hidden=!list.length;
    const ids=list.map(m=>m.id).join(',');
    if(ids!==tickerIDs){const offset=track.scrollLeft;track.innerHTML=list.map(m=>`<a class="cup-ticker-game" data-ticker-id="${m.id}" href="match.php?id=${m.id}"><small><span>${esc(m.category)}</span><span data-ticker-status></span></small><strong><span>${esc(m.home)}</span><span data-home-score></span></strong><strong><span>${esc(m.away)}</span><span data-away-score></span></strong></a>`).join('');track.scrollLeft=offset;tickerIDs=ids;}
    list.forEach(m=>{const el=track.querySelector(`[data-ticker-id="${m.id}"]`);el.querySelector('[data-ticker-status]').textContent=m.status==='scheduled'?time(m):status(m);el.querySelector('[data-ticker-status]').classList.toggle('cup-live-dot',m.status==='live');el.querySelector('[data-home-score]').textContent=m.status==='scheduled'?'–':m.home_score;el.querySelector('[data-away-score]').textContent=m.status==='scheduled'?'–':m.away_score;});
  }
  function posters(){const root=document.querySelector('#cup-posters');if(!root||!data)return;const area=document.querySelector('#cup-poster-area');area.hidden=!data.posters.length;
    const ids=data.posters.map(p=>p.id+':'+p.image+':'+p.title+':'+p.alt+':'+p.link).join('|');if(root.dataset.signature===ids)return;root.dataset.signature=ids;
    root.innerHTML=data.posters.map(p=>`<article class="cup-poster">${p.link?`<a href="${esc(p.link)}" rel="noopener noreferrer">`:''}<img src="${esc(p.image)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">${p.link?'</a>':''}<h3>${esc(p.title)}</h3></article>`).join('');
  }
  async function poll(){
    if(document.hidden||inFlight)return;inFlight=true;
    try{const standingsRoot=document.querySelector('[data-live-standings]');const response=await fetch('api/results.php'+(standingsRoot?'?competition='+standingsRoot.dataset.liveStandings:''),{cache:'no-store'});if(!response.ok)throw new Error('Unavailable');data=await response.json();if(stale)stale.hidden=true;
      if(filter){const value=filter.value;const categories=[...new Map(data.matches.map(m=>[String(m.category_id),m.category])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));const signature=JSON.stringify(categories);if(filter.dataset.signature!==signature){filter.innerHTML='<option value="">All categories</option>'+categories.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');filter.value=value;filter.dataset.signature=signature;}}
      renderTicker();renderLive();posters();updateCards(data.matches);
      if(standingsRoot&&data.standings){const list=data.standings[standingsRoot.dataset.provisional==='1'?'provisional':'official'];const signature=JSON.stringify(list);if(standingsRoot.dataset.signature!==signature){const groups=new Map();list.forEach(e=>{const key=e.group_name||'Teams';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);});document.querySelector('#cup-standings-tables').innerHTML=[...groups].map(([name,entries])=>`<h2>${esc(name)}</h2><div class="cup-table-wrap"><table><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${entries.map(e=>`<tr><td>${esc(e.name)}</td>${['played','wins','draws','losses','gf','ga','gd','points'].map(k=>`<td>${e[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');standingsRoot.dataset.signature=signature;}}
      const detail=document.querySelector('[data-match-detail]');if(detail){const m=data.matches.find(m=>Number(m.id)===Number(detail.dataset.matchDetail));if(m)await updateDetail(m);}
    }catch{if(stale)stale.hidden=false;}finally{inFlight=false;retryTimer=setTimeout(poll,5000);}
  }
  async function updateDetail(m){
    const el=document.querySelector('#cup-match-events');if(!el)return;
    const r=await fetch('api/match.php?id='+m.id,{cache:'no-store'});if(!r.ok)throw new Error('Unavailable');const d=await r.json();
    const sig=JSON.stringify(d.events);if(el.dataset.signature!==sig){el.innerHTML=d.events.map(e=>`<li>${e.minute}′ · ${esc(e.team)} · ${esc(e.player||'Scorer not recorded')}${e.number!==null?' #'+e.number:''}${e.kind==='own_goal'?' (own goal)':''}</li>`).join('')||'<li>No goals recorded.</li>';el.dataset.signature=sig;}
    const penalties=document.querySelector('#cup-match-penalties');if(penalties)penalties.textContent=m.home_penalties!==null?`Penalties: ${m.home_penalties} – ${m.away_penalties}`:'';
  }
  document.querySelector('#cup-ticker-pause')?.addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'Play':'Pause';e.currentTarget.setAttribute('aria-pressed',String(paused));});
  track?.addEventListener('pointerenter',()=>hover=true);track?.addEventListener('pointerleave',()=>hover=false);track?.addEventListener('focusin',()=>hover=true);track?.addEventListener('focusout',()=>hover=false);
  const pauseManual=()=>{paused=true;const b=document.querySelector('#cup-ticker-pause');if(b){b.textContent='Play';b.setAttribute('aria-pressed','true');}};
  track?.addEventListener('pointerdown',pauseManual);track?.addEventListener('wheel',pauseManual,{passive:true});track?.addEventListener('keydown',pauseManual);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function animate(t){if(track&&!document.hidden&&!paused&&!hover&&!reduced.matches&&lastFrame&&track.scrollWidth>track.clientWidth){tickerPosition+=Math.min(t-lastFrame,50)*.025;if(tickerPosition>=track.scrollWidth-track.clientWidth)tickerPosition=0;track.scrollLeft=tickerPosition;}else if(track)tickerPosition=track.scrollLeft;lastFrame=t;requestAnimationFrame(animate);}requestAnimationFrame(animate);
  filter?.addEventListener('change',()=>{liveIDs='';renderLive();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(retryTimer);poll();}});
  document.querySelectorAll('[data-poster-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector('#cup-posters')?.scrollBy({left:Number(b.dataset.posterScroll)*360,behavior:reduced.matches?'instant':'smooth'})));
  document.querySelector('.cup-menu-toggle')?.addEventListener('click',e=>{const nav=document.querySelector('.cup-nav');const open=nav.classList.toggle('is-open');e.currentTarget.setAttribute('aria-expanded',String(open));});
  poll();
})();
