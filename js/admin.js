/* Administration uses server permissions; client controls are presentation only. */
(() => {
  'use strict';
  const boot = window.CUP_ADMIN, notice = document.querySelector('#notice'), work = document.querySelector('#workspace');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {seasons:'Temporadas',categories:'Categorías',competitions:'Competiciones',teams:'Equipos',entries:'Inscripciones',players:'Jugadores',rosters:'Plantillas',venues:'Sedes / estadios',fields:'Canchas',users:'Usuarios',posters:'Pósteres',matches:'Partidos',organize:'Organización',audit:'Historial de cambios',account:'Mi contraseña'};
  const schema = {
    seasons:[['name','Nombre'],['timezone','Zona horaria','text','America/New_York'],['active','Temporada activa','checkbox'],['archived','Archivada','checkbox']],
    categories:[['name','Nombre'],['min_age','Edad mínima','number'],['max_age','Edad máxima','number'],['archived','Archivada','checkbox']],
    competitions:[['season_id','Temporada','seasons'],['category_id','Categoría','categories'],['format','Formato','format'],['duration','Duración en minutos','number',90],['win_points','Puntos por victoria','number',3],['draw_points','Puntos por empate','number',1],['loss_points','Puntos por derrota','number',0],['group_count','Número de grupos','number',2],['group_capacity','Capacidad por grupo','number',4],['qualifiers','Clasifican por grupo','number',2]],
    teams:[['name','Nombre'],['crest','Escudo','image'],['archived','Archivado','checkbox']],
    entries:[['competition_id','Competición','competitions'],['team_id','Equipo','teams']],
    players:[['name','Nombre deportivo'],['birth_date','Nacimiento (privado)','date'],['contact','Contacto (privado)'],['archived','Archivado','checkbox']],
    rosters:[['entry_id','Inscripción de equipo','entries'],['player_id','Jugador','players'],['number','Dorsal','number',1]],
    venues:[['name','Nombre'],['address','Dirección'],['archived','Archivada','checkbox']],
    fields:[['name','Nombre'],['venue_id','Sede / estadio','venues'],['archived','Archivada','checkbox']],
    users:[['name','Nombre'],['email','Correo','email'],['role','Permiso','role'],['password','Contraseña (mínimo 12 caracteres)','password'],['active','Activo','checkbox',1]],
    posters:[['title','Título'],['alt','Descripción de imagen'],['image','Imagen','image'],['link','Enlace opcional','url'],['sort_order','Orden','number',0],['active','Publicado','checkbox',1],['starts_at','Publicar desde','datetime-local'],['ends_at','Publicar hasta','datetime-local']]
  };
  let state = {}, tab = 'matches', selected = null, organization = null, live = null, busy = false, pending = null;
  function message(text, error = false) { notice.textContent = text; notice.className = error ? 'cup-message error' : 'cup-message'; }
  async function api(data = null, query = '') {
    const response = await fetch('api.php' + query, data ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,csrf:boot.csrf})} : {cache:'no-store'});
    const json = await response.json();
    if (!response.ok) { const e = new Error(json.error || 'Error de servidor.'); e.server = true; if(response.status===401 && boot.loggedIn) location.reload(); throw e; }
    if (json.csrf) boot.csrf = json.csrf;
    return json;
  }
  const by = (type,id) => (state[type] || []).find(x=>Number(x.id)===Number(id));
  function name(type, value) {
    if(type==='competitions') return `${by('seasons',value.season_id)?.name || ''} · ${by('categories',value.category_id)?.name || ''}`;
    if(type==='entries') return `${by('teams',value.team_id)?.name || ''} · ${name('competitions',by('competitions',value.competition_id)||{})} [#${value.id}]`;
    if(type==='rosters') return `${by('players',value.player_id)?.name || ''} #${value.number} · ${name('entries',by('entries',value.entry_id)||{})}`;
    return value.name || value.title || '#' + value.id;
  }
  function options(type, value, empty = true) {
    const list = type==='format' ? [{id:'groups',name:'Grupos + eliminatorias'},{id:'knockout',name:'Eliminación directa'}] : type==='role' ? [{id:'admin',name:'Administrador'},{id:'scorer',name:'Anotador'}] : state[type] || [];
    return (empty?'<option value="">Seleccionar…</option>':'') + list.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(value)?'selected':''}>${esc(name(type,x))}</option>`).join('');
  }
  function localDate(value, timezone='America/New_York') {
    if(!value) return '';
    const date = new Date(value.replace(' ','T') + (value.endsWith('Z')?'':'Z'));
    return new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');
  }
  function field([key,label,type='text',fallback=''], item={}) {
    let value = item[key] ?? fallback;
    if(type==='checkbox') return `<label class="cup-check"><input type="checkbox" name="${key}" ${Number(value)?'checked':''}>${label}</label>`;
    if(type==='image') return `<label>${label}<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${key}"><input type="hidden" name="${key}" value="${esc(value)}"><small data-image="${key}">${esc(value)}</small></label>`;
    if(state[type] || ['format','role'].includes(type)) return `<label>${label}<select name="${key}" required>${options(type,value,false)}</select></label>`;
    if(type==='datetime-local') value = localDate(value);
    return `<label>${label}<input name="${key}" type="${type}" value="${type==='password'?'':esc(value)}" ${['name','title','alt','email'].includes(key)?'required':''} ${type==='password'?'minlength="12" autocomplete="new-password"':''} ${type==='number'?'min="0" max="999"':''}></label>`;
  }
  async function refresh() { state = await api(); }
  function drawNav() {
    const tabs = state.user.role==='admin'?['matches','seasons','categories','competitions','teams','entries','players','rosters','venues','fields','organize','posters','users','audit','account']:['matches','account'];
    document.querySelector('#admin-nav').innerHTML = tabs.map(key=>`<button data-tab="${key}" class="${key===tab?'active':''}">${labels[key]}</button>`).join('');
  }
  function renderResource() {
    const item = selected ? by(tab,selected) || {} : {};
    work.innerHTML = `<div class="cup-toolbar"><h2>${labels[tab]}</h2><button data-new class="cup-secondary">Nuevo registro</button></div><div class="cup-split"><form id="entity-form" class="cup-form"><h3>${selected?'Editar #'+selected:'Agregar'}</h3>${schema[tab].map(f=>field(f,item)).join('')}<button>Guardar</button><p class="cup-muted">Archivar conserva los datos vinculados al historial. Las fechas usan America/New_York.</p></form><div><input id="resource-search" type="search" placeholder="Filtrar registros…" aria-label="Filtrar registros"><div class="cup-table-wrap"><table><thead><tr><th>ID</th><th>Registro</th><th>Estado</th><th></th></tr></thead><tbody>${(state[tab]||[]).map(x=>`<tr><td>${x.id}</td><td>${esc(name(tab,x))}</td><td>${Number(x.archived)?'Archivado':x.active!==undefined?(Number(x.active)?'Activo':'Inactivo'):''}</td><td>${tab==='entries'?'':`<button class="cup-secondary" data-edit="${x.id}">Editar</button>`}</td></tr>`).join('')}</tbody></table></div></div></div>`;
    document.querySelector('#resource-search').oninput = e => work.querySelectorAll('tbody tr').forEach(tr=>tr.hidden=!tr.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
    document.querySelector('#entity-form').onsubmit = async e => {
      e.preventDefault(); await perform(async()=> { const data = Object.fromEntries(new FormData(e.target)); e.target.querySelectorAll('[type=checkbox]').forEach(x=>data[x.name]=x.checked?1:0);if(selected)data.id=selected;await api({action:'save',resource:tab,data});await refresh();selected=null;render();message('Registro guardado.'); });
    };
    work.querySelectorAll('[data-upload]').forEach(input=>input.onchange=async()=>perform(async()=>{
      if(!input.files[0])return;const form=new FormData();form.set('csrf',boot.csrf);form.set('action','upload');form.set('image',input.files[0]);const r=await fetch('api.php',{method:'POST',body:form});const data=await r.json();if(!r.ok)throw new Error(data.error);work.querySelector(`[name="${input.dataset.upload}"]`).value=data.path;work.querySelector(`[data-image="${input.dataset.upload}"]`).textContent='Imagen lista: '+data.path;
    }));
  }
  const statusText = s=>({scheduled:'Programado',live:'En juego',half_time:'Descanso',paused:'Pausado',finished:'Finalizado',suspended:'Suspendido'}[s]||s);
  function renderMatches() {
    const list = (state.matches||[]).filter(m=>!Number(m.historical));
    work.innerHTML=`<div class="cup-toolbar"><div><p class="cup-eyebrow">CONTROL DE JORNADA</p><h2>Partidos</h2></div><button data-refresh class="cup-secondary">Actualizar</button></div><p>Los anotadores ven únicamente los encuentros asignados. Cada partido se controla de forma independiente.</p><div class="cup-match-grid">${list.length?list.map(m=>`<article class="cup-match-card"><small>${esc(m.season)} · ${esc(m.category)}</small><p class="cup-badge ${m.status==='live'?'is-live':''}">${statusText(m.status)} ${Number(m.confirmed)?'· Confirmado':''}</p><h3>${esc(m.home)} <b>${m.home_score} – ${m.away_score}</b> ${esc(m.away)}</h3><p>${esc(m.field || 'Sin cancha')} · ${m.scheduled_at?esc(localDate(m.scheduled_at,m.timezone).replace('T',' ')):'Sin horario'}</p><button data-match="${m.id}">Abrir partido #${m.id}</button></article>`).join(''):'<p>No hay partidos. Crea temporada, categoría, competición e inscripciones y publica un sorteo desde Organización.</p>'}</div>`;
  }
  function renderOrganization() {
    const comps=(state.competitions||[]).filter(c=>!Number(c.historical)); organization ||= comps[0]?.id;
    const c=by('competitions',organization); const entries=(state.entries||[]).filter(e=>Number(e.competition_id)===Number(organization));
    work.innerHTML=`<h2>Organización</h2><label>Competición<select id="org-select">${comps.map(c=>`<option value="${c.id}" ${Number(c.id)===Number(organization)?'selected':''}>${esc(name('competitions',c))}</option>`).join('')}</select></label>${!c?'<p>Crea primero una competición.</p>':`<p>${c.format==='groups'?'Grupos + eliminatorias':'Eliminación directa'} · ${c.duration} minutos · ${entries.length} equipos inscritos.</p><details><summary>IDs de inscripción para asignación manual</summary><ul>${entries.map(e=>`<li>#${e.id}: ${esc(name('entries',e))}</li>`).join('')}</ul></details><div class="cup-split"><div><h3>Asignación de equipos</h3><form id="draw-form"><label>Método<select name="mode"><option value="random">Ruleta aleatoria</option><option value="manual">Orden manual</option></select></label><label>IDs en orden, separados por coma<textarea name="order" placeholder="${entries.map(e=>e.id).join(', ')}"></textarea></label><p class="cup-muted">En grupos, los IDs se reparten por turnos: grupo 1, grupo 2… En eliminación, se emparejan consecutivamente; si faltan equipos para completar la llave, los primeros reciben pase libre.</p><button>Generar vista previa</button></form><div id="draw-preview"></div></div><div><h3>Clasificación y cruces finales</h3><button id="load-standings" class="cup-secondary">Consultar clasificación oficial</button><div id="official-table"></div><form id="qualify-form"><label>Clasificados en orden de cruces<textarea name="order" required placeholder="ID local, ID visitante, siguiente local…"></textarea></label><p class="cup-muted">Confirma todos los grupos. Respeta los mejores clasificados; resuelve manualmente empates exactos. El orden determina los cruces.</p><button>Confirmar clasificados y crear llaves</button></form></div></div><details><summary>Corregir organización y rondas dependientes</summary><p>Retirar el sorteo solo es posible antes de iniciar partidos. Para corregir un resultado con dependencias, retira las rondas posteriores no iniciadas y después reabre el resultado. Conserva el motivo.</p><button id="reset-draw" class="cup-secondary">Retirar sorteo pendiente</button><form id="remove-rounds"><label>Retirar eliminatorias desde ronda<input name="from_round" type="number" min="1" value="1" required></label><label>Motivo<input name="reason" required></label><button>Retirar rondas no iniciadas</button></form><button id="rebuild-rounds" class="cup-secondary">Reconstruir rondas posteriores</button></details>`}`;
    document.querySelector('#org-select').onchange=e=>{organization=Number(e.target.value);renderOrganization();};if(!c)return;
    document.querySelector('#draw-form').onsubmit=e=>{e.preventDefault();perform(async()=>{
      const data=await api({action:'preview',competition_id:organization,...Object.fromEntries(new FormData(e.target))}); const p=data.preview;
      document.querySelector('#draw-preview').innerHTML=`<div class="cup-wheel" aria-hidden="true">⚽</div><h3>Vista previa · sin publicar</h3>${p.groups.length?Object.values(p.groups).map((group,i)=>`<h4>Grupo ${i+1}</h4><p>${group.map(id=>esc(name('entries',by('entries',id)||{}))).join('<br>')}</p>`).join(''):`<p>${p.entries.map(id=>esc(name('entries',by('entries',id)||{}))).join('<br>')}</p><p>Los pases libres se asignan primero, según este orden.</p>`}<button id="publish-draw">Confirmar y publicar sorteo</button>`;
      document.querySelector('#publish-draw').onclick=()=>perform(async()=>{await api({action:'publish_draw'});await refresh();renderOrganization();message('Sorteo publicado. Los partidos ya aparecen en el calendario.');});
    });};
    document.querySelector('#qualify-form').onsubmit=e=>{e.preventDefault();perform(async()=>{await api({action:'qualify',competition_id:organization,...Object.fromEntries(new FormData(e.target))});await refresh();renderOrganization();message('Clasificados confirmados y llaves creadas.');});};
    document.querySelector('#load-standings').onclick=()=>perform(async()=>{const data=await api(null,'?competition_id='+organization);document.querySelector('#official-table').innerHTML='<div class="cup-table-wrap"><table><tr><th>Grupo</th><th>ID</th><th>Equipo</th><th>Pts</th><th>DG</th><th>GF</th></tr>'+data.standings.map(e=>`<tr><td>${esc(e.group_name)}</td><td>${e.id}</td><td>${esc(e.name)}</td><td>${e.points}</td><td>${e.gd}</td><td>${e.gf}</td></tr>`).join('')+'</table></div>';});
    document.querySelector('#reset-draw').onclick=()=>{if(confirm('¿Retirar el sorteo y la programación pendiente de esta competición?'))perform(async()=>{await api({action:'reset_draw',competition_id:organization});await refresh();renderOrganization();message('Sorteo retirado.');});};
    document.querySelector('#remove-rounds').onsubmit=e=>{e.preventDefault();if(confirm('¿Retirar las rondas indicadas?'))perform(async()=>{await api({action:'remove_rounds',competition_id:organization,...Object.fromEntries(new FormData(e.target))});await refresh();renderOrganization();message('Rondas retiradas.');});};
    document.querySelector('#rebuild-rounds').onclick=()=>perform(async()=>{await api({action:'rebuild_rounds',competition_id:organization});await refresh();message('Rondas reconstruidas.');});
  }
  async function openMatch(id) {
    live=await api(null,'?match_id='+id);tab='live';drawNav();renderLive();
  }
  function liveSummary() {
    const m=live.match;return `<small>${esc(m.category)} · ${esc(m.field||'Sin cancha')}</small><h2>${esc(m.home)} <b>${m.home_score} – ${m.away_score}</b> ${esc(m.away)}</h2><p class="cup-badge ${m.status==='live'?'is-live':''}">${statusText(m.status)} · ${Math.floor(m.elapsed/60)}′ ${Number(m.confirmed)?'· Confirmado':''}</p>`;
  }
  function eventsHTML(){return live.events.map(e=>`<li class="${Number(e.voided)?'cup-voided':''}">${e.minute}′ ${esc(e.player||'Sin autor')} ${e.number!==null?'#'+e.number:''} · ${e.kind==='own_goal'?'Autogol':'Gol'} · ${Number(e.entry_id)===Number(live.match.home_entry_id)?esc(live.match.home):esc(live.match.away)} ${Number(e.voided)?'· Anulado: '+esc(e.reason):`<button data-void="${e.id}" class="cup-secondary">Anular</button>`}</li>`).join('')||'<li>No hay goles registrados.</li>';}
  function renderLive() {
    const m=live.match;
    work.innerHTML=`<button data-back class="cup-secondary">← Partidos</button><div id="live-summary">${liveSummary()}</div><p id="live-connection" class="cup-muted">Conectado · las acciones se confirman después de guardar.</p><div class="cup-toolbar" id="status-actions"></div><div class="cup-split"><form id="goal-form"><h3>Registrar gol</h3><label>Equipo<select id="goal-team" name="entry_id" required><option value="${m.home_entry_id}">${esc(m.home)}</option><option value="${m.away_entry_id}">${esc(m.away)}</option></select></label><label>Autor<select id="goal-player" name="roster_id"></select></label><label>Tipo<select name="kind"><option value="goal">Gol</option><option value="own_goal">Autogol (cuenta al rival)</option></select></label><label>Minuto<input name="minute" type="number" min="0" max="300" value="${Math.floor(m.elapsed/60)}" required></label><button>Guardar gol</button><button type="button" id="retry-action" hidden>Reintentar operación pendiente</button></form><div><h3>Registro del partido</h3><ol id="event-list">${eventsHTML()}</ol></div></div>${state.user.role==='admin'?`<div class="cup-split"><form id="schedule-form"><h3>Programación</h3><label>Cancha<select name="field_id">${options('fields',m.field_id)}</select></label><label>Fecha y hora (${esc(m.timezone)})<input type="datetime-local" name="scheduled_at" value="${esc(localDate(m.scheduled_at,m.timezone))}"></label><button>Guardar programación</button></form><form id="assign-form"><h3>Anotador</h3><label>Usuario<select name="user_id"><option value="">Sin asignar</option>${(state.users||[]).filter(u=>u.role==='scorer'&&Number(u.active)).map(u=>`<option value="${u.id}" ${(state.assignments||[]).some(a=>Number(a.match_id)===Number(m.id)&&Number(a.user_id)===Number(u.id))?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label><button>Guardar asignación</button></form></div><form id="confirm-form"><h3>Confirmar resultado oficial</h3><p>Solo al finalizar. Los penales se usan únicamente para desempatar eliminatorias.</p><div class="cup-toolbar"><label>Penales local<input name="home_penalties" type="number" min="0" max="100"></label><label>Penales visitante<input name="away_penalties" type="number" min="0" max="100"></label></div><button>Confirmar resultado</button><button type="button" id="reopen-match" class="cup-secondary">Reabrir con motivo</button></form>`:''}`;
    renderStatus();
    const players=()=>{document.querySelector('#goal-player').innerHTML='<option value="">Sin autor / pendiente de identificar</option>'+live.roster.filter(p=>Number(p.entry_id)===Number(document.querySelector('#goal-team').value)).map(p=>`<option value="${p.id}">#${p.number} ${esc(p.name)}</option>`).join('');};players();document.querySelector('#goal-team').onchange=players;
    document.querySelector('#goal-form').onsubmit=e=>{e.preventDefault();sendMatch({action:'goal',...Object.fromEntries(new FormData(e.target))});};
    document.querySelector('#retry-action').onclick=()=>sendMatch(null);
    if(state.user.role==='admin') {
      document.querySelector('#schedule-form').onsubmit=e=>{e.preventDefault();perform(async()=>{await api({action:'schedule',match_id:m.id,...Object.fromEntries(new FormData(e.target))});await refresh();await openMatch(m.id);message('Programación guardada.');});};
      document.querySelector('#assign-form').onsubmit=e=>{e.preventDefault();perform(async()=>{await api({action:'assign',match_id:m.id,...Object.fromEntries(new FormData(e.target))});await refresh();message('Anotador asignado.');});};
      document.querySelector('#confirm-form').onsubmit=e=>{e.preventDefault();sendMatch({action:'confirm',...Object.fromEntries(new FormData(e.target))});};
      document.querySelector('#reopen-match').onclick=()=>{const reason=prompt('Motivo de la reapertura:');if(reason)sendMatch({action:'reopen',reason});};
    }
  }
  function renderStatus(){
    const allowed={scheduled:['live','suspended'],live:['half_time','paused','finished','suspended'],half_time:['live','finished','suspended'],paused:['live','finished','suspended'],suspended:['live','finished'],finished:[]};
    document.querySelector('#status-actions').innerHTML=Number(live.match.confirmed)?'Resultado oficial confirmado.':(allowed[live.match.status]||[]).map(status=>`<button data-status="${status}">${status==='live'?'Iniciar / reanudar':statusText(status)}</button>`).join('');
  }
  async function sendMatch(data) {
    if(busy)return;
    if(pending && data){message('Reintenta primero la operación pendiente para evitar duplicados.',true);return;}
    if(data)pending={...data,match_id:live.match.id,version:live.match.version,request_key:crypto.randomUUID()};
    if(!pending)return;
    await perform(async()=>{
      try{await api({action:'match',data:pending});pending=null;await openMatch(live.match.id);message('Cambio guardado.');}
      catch(e){if(e.server)pending=null;const retry=document.querySelector('#retry-action');if(retry)retry.hidden=!pending;throw e;}
    });
  }
  function render() {
    drawNav();work.removeAttribute('aria-busy');
    if(schema[tab])renderResource();else if(tab==='matches')renderMatches();else if(tab==='organize')renderOrganization();
    else if(tab==='audit')work.innerHTML='<h2>Historial de cambios</h2><div class="cup-table-wrap"><table><tr><th>Fecha UTC</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>Detalle</th></tr>'+(state.audit||[]).map(a=>`<tr><td>${esc(a.created_at)}</td><td>${esc(a.actor||'Instalación')}</td><td>${esc(a.action)}</td><td>${esc(a.entity)} #${a.entity_id}</td><td><pre>${esc(a.details)}</pre></td></tr>`).join('')+'</table></div>';
    else if(tab==='account'){work.innerHTML='<h2>Cambiar contraseña</h2><form id="password-form"><label>Contraseña actual<input name="current_password" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button>Guardar contraseña</button></form>';document.querySelector('#password-form').onsubmit=e=>{e.preventDefault();perform(async()=>{await api({action:'password',...Object.fromEntries(new FormData(e.target))});e.target.reset();message('Contraseña actualizada.');});};}
  }
  async function perform(fn) {
    if(busy)return;busy=true;work?.setAttribute('aria-busy','true');const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{await fn();}catch(e){message(e.message||'Sin conexión. Vuelve a intentarlo.',true);}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);work?.removeAttribute('aria-busy');}
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button || busy)return;
    if(button.dataset.tab){if(pending){message('Resuelve primero la operación pendiente.',true);return;}tab=button.dataset.tab;selected=null;live=null;render();}
    if(button.hasAttribute('data-new')){selected=null;renderResource();}
    if(button.dataset.edit){selected=Number(button.dataset.edit);renderResource();}
    if(button.dataset.match)perform(()=>openMatch(Number(button.dataset.match)));
    if(button.hasAttribute('data-back')){if(pending){message('Resuelve primero la operación pendiente.',true);return;}live=null;tab='matches';perform(async()=>{await refresh();render();});}
    if(button.dataset.status)sendMatch({action:'status',status:button.dataset.status});
    if(button.dataset.void){const reason=prompt('Motivo de la anulación:');if(reason)sendMatch({action:'void',event_id:button.dataset.void,reason});}
    if(button.hasAttribute('data-refresh'))perform(async()=>{await refresh();render();});
  });
  document.querySelector('#login')?.addEventListener('submit',e=>{e.preventDefault();perform(async()=>{await api({action:'login',...Object.fromEntries(new FormData(e.target))});location.reload();});});
  const loginButton=document.querySelector('#login button');if(loginButton)loginButton.disabled=false;
  document.querySelector('#logout')?.addEventListener('click',()=>perform(async()=>{await api({action:'logout'});location.reload();}));
  if(boot.loggedIn){perform(async()=>{await refresh();drawNav();render();});setInterval(async()=>{
    if(document.hidden || busy || !live || pending)return;
    try{const latest=await api(null,'?match_id='+live.match.id);live=latest;document.querySelector('#live-summary').innerHTML=liveSummary();document.querySelector('#event-list').innerHTML=eventsHTML();document.querySelector('#live-connection').textContent='Conectado · actualizado '+new Date().toLocaleTimeString();renderStatus();}
    catch{const el=document.querySelector('#live-connection');if(el)el.textContent='Sin conexión · se conservan los últimos datos. No cierres una operación pendiente.';}
  },5000);}
})();
