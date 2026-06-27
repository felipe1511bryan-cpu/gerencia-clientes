// ========== SUPABASE ==========
const SUPABASE_URL = 'https://yxbizwnfqanlojydjanw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Yml6d25mcWFubG9qeWRqYW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDI4NzEsImV4cCI6MjA5NzgxODg3MX0.QlH2vi52_6d-UzwxInKWOtRSwuPVEUnWOV8UbM_fHIM';
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ========== STATE ==========
let todosClientes = [];
let todosGrupos = [];     // [{id, nome, cor}]
let grupoAtivo = null;    // null = todos
let clienteAtualId = null;
let chartPizza = null;
let chartBarra = null;
let corSelecionada = '#c9a84c';

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta'];
const CORES = ['#c9a84c','#2dbd7a','#3b82f6','#8b5cf6','#d94040','#e8a020','#ec4899','#06b6d4','#f97316','#84cc16'];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    if (!supabaseClient) { showToast('❌ Supabase não conectado', 'error'); return; }
    
    // Autenticação anônima
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            const { error } = await supabaseClient.auth.signInAnonymously();
            if (error) throw error;
        }
    } catch (err) {
        console.error('Erro autenticação:', err);
        showToast('❌ Erro ao conectar', 'error');
        return;
    }
    
    atualizarData();
    inicializarGraficos();
    setupNavegacao();
    setupForm();
    setupBusca();
    setupModal();
    setupModalGrupo();
    setupMobile();
    renderCorPicker();
    await carregarGrupos();
    await carregarClientes();
});

// ========== NAVEGAÇÃO ==========
function setupNavegacao() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            mudarSecao(this.dataset.section);
            fecharSidebar();
        });
    });
}

function mudarSecao(secao) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(secao)?.classList.add('active');
    document.querySelector(`.nav-btn[data-section="${secao}"]`)?.classList.add('active');
    const titulos = { dashboard:'Dashboard', clientes:'Clientes', adicionar:'Adicionar Cliente', relatorios:'Relatórios' };
    document.getElementById('page-title').textContent = titulos[secao] || 'Gestor';
}

// ========== MOBILE ==========
function setupMobile() {
    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('open');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', fecharSidebar);
}
function fecharSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
}

// ========== DATA ==========
function atualizarData() {
    const opts = { weekday:'short', day:'numeric', month:'short' };
    document.getElementById('data-atual').textContent = new Date().toLocaleDateString('pt-BR', opts);
}

// ========== GRUPOS SUPABASE ==========
async function carregarGrupos() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabaseClient
            .from('grupos')
            .select('*')
            .eq('user_id', user.id)
            .order('nome');
        if (error) throw error;
        todosGrupos = data || [];
        renderGruposSidebar();
        renderGruposForm();
    } catch (err) {
        console.error('Erro grupos:', err);
    }
}

async function criarGrupo(nome, cor) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const { error } = await supabaseClient.from('grupos').insert([{ 
            nome: nome.trim(), 
            cor,
            user_id: user.id
        }]);
        if (error) throw error;
        showToast('✅ Grupo criado!', 'success');
        await carregarGrupos();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

async function deletarGrupo(id) {
    if (!confirm('Deletar este grupo? As clientes não serão removidas.')) return;
    try {
        // Remove grupo do array de grupos de cada cliente
        const afetadas = todosClientes.filter(c => (c.grupos || []).includes(id));
        for (const c of afetadas) {
            const novosGrupos = (c.grupos || []).filter(g => g !== id);
            await supabaseClient.from('clientes').update({ grupos: novosGrupos }).eq('id', c.id);
        }
        await supabaseClient.from('grupos').delete().eq('id', id);
        if (grupoAtivo === id) grupoAtivo = null;
        showToast('Grupo removido', 'success');
        await carregarGrupos();
        await carregarClientes();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// ========== RENDER GRUPOS SIDEBAR ==========
function renderGruposSidebar() {
    const list = document.getElementById('grupos-list');
    const nomeGrupoAtivo = grupoAtivo ? (todosGrupos.find(g => g.id === grupoAtivo)?.nome || 'Grupo') : 'Todos';

    // Badge no header
    document.getElementById('grupo-badge').textContent = nomeGrupoAtivo;
    document.getElementById('clientes-grupo-badge').textContent = grupoAtivo ? '🏷️ ' + nomeGrupoAtivo : '🌐 Todos';
    document.getElementById('relatorios-grupo-badge').textContent = grupoAtivo ? '🏷️ ' + nomeGrupoAtivo : '🌐 Todos';

    const btnAll = `<button class="grupo-btn-all ${!grupoAtivo ? 'active' : ''}" id="btn-grupo-all">🌐 Todos os grupos</button>`;
    const btnGrupos = todosGrupos.map(g => {
        const qtd = todosClientes.filter(c => (c.grupos || []).includes(g.id)).length;
        return `
        <button class="grupo-btn ${grupoAtivo === g.id ? 'active' : ''}" data-grupo-id="${g.id}">
            <div class="grupo-btn-left">
                <div class="grupo-dot" style="background:${g.cor}"></div>
                <span class="grupo-btn-name">${escapeHtml(g.nome)}</span>
            </div>
            <span class="grupo-count-badge">${qtd}</span>
        </button>`;
    }).join('');

    const empty = todosGrupos.length === 0
        ? `<div class="grupos-empty">Nenhum grupo ainda.<br>Clique em <strong>+ Novo</strong> para criar.</div>` : '';

    list.innerHTML = btnAll + btnGrupos + empty;

    // eventos
    document.getElementById('btn-grupo-all').addEventListener('click', () => {
        grupoAtivo = null;
        renderGruposSidebar();
        atualizarTudo();
        fecharSidebar();
    });

    list.querySelectorAll('.grupo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            grupoAtivo = parseInt(this.dataset.grupoId);
            renderGruposSidebar();
            atualizarTudo();
            fecharSidebar();
        });
    });
}

// ========== RENDER GRUPOS NO FORM ==========
function renderGruposForm(selecionados = []) {
    const el = document.getElementById('form-grupos-list');
    if (!el) return;
    if (todosGrupos.length === 0) {
        el.innerHTML = '<p class="grupos-form-empty">Nenhum grupo criado ainda.</p>';
        return;
    }
    el.innerHTML = todosGrupos.map(g => {
        const checked = selecionados.includes(g.id);
        return `
        <label class="grupo-checkbox-item ${checked ? 'checked' : ''}" data-grupo-id="${g.id}">
            <input type="checkbox" value="${g.id}" ${checked ? 'checked' : ''}>
            <div class="grupo-checkbox-dot" style="background:${g.cor}"></div>
            <span class="grupo-checkbox-name">${escapeHtml(g.nome)}</span>
        </label>`;
    }).join('');

    el.querySelectorAll('.grupo-checkbox-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') {
                this.classList.toggle('checked', e.target.checked);
            }
        });
    });
}

function renderGruposModal(selecionados = []) {
    const el = document.getElementById('modal-grupos-list');
    if (!el) return;
    if (todosGrupos.length === 0) {
        el.innerHTML = '<p class="grupos-form-empty">Nenhum grupo criado.</p>';
        return;
    }
    el.innerHTML = todosGrupos.map(g => {
        const checked = selecionados.includes(g.id);
        return `
        <label class="grupo-checkbox-item ${checked ? 'checked' : ''}" data-grupo-id="${g.id}">
            <input type="checkbox" value="${g.id}" ${checked ? 'checked' : ''}>
            <div class="grupo-checkbox-dot" style="background:${g.cor}"></div>
            <span class="grupo-checkbox-name">${escapeHtml(g.nome)}</span>
        </label>`;
    }).join('');

    el.querySelectorAll('.grupo-checkbox-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') {
                this.classList.toggle('checked', e.target.checked);
            }
        });
    });
}

function getGruposSelecionados(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`))
        .map(cb => parseInt(cb.value));
}

// ========== SUPABASE CLIENTES ==========
async function carregarClientes() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('user_id', user.id)
            .order('dia')
            .order('horario');
        if (error) throw error;
        todosClientes = data || [];
        atualizarTudo();
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar clientes', 'error');
    }
}

function clientesFiltrados() {
    if (!grupoAtivo) return todosClientes;
    return todosClientes.filter(c => (c.grupos || []).includes(grupoAtivo));
}

function atualizarTudo() {
    renderClientes();
    atualizarEstatisticas();
    atualizarGraficos();
    atualizarRelatorios();
    renderGruposSidebar();
}

async function adicionarCliente(e) {
    e.preventDefault();
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const grupos = getGruposSelecionados('form-grupos-list');
    const novoCliente = {
        nome: document.getElementById('nome').value.trim(),
        unidade: document.getElementById('unidade').value.trim(),
        dia: document.getElementById('dia').value,
        horario: document.getElementById('horario').value,
        status: document.getElementById('status').value,
        grupos: grupos,
        user_id: user.id
    };
    try {
        const { error } = await supabaseClient.from('clientes').insert([novoCliente]);
        if (error) throw error;
        showToast('✅ Cliente adicionada!', 'success');
        document.getElementById('form-cliente').reset();
        renderGruposForm();
        await carregarClientes();
        mudarSecao('clientes');
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

async function salvarEdicaoCliente() {
    if (!clienteAtualId) return;
    const status = document.getElementById('modal-status').value;
    const grupos = getGruposSelecionados('modal-grupos-list');
    try {
        const { error } = await supabaseClient.from('clientes').update({ status, grupos }).eq('id', clienteAtualId);
        if (error) throw error;
        showToast('✅ Cliente atualizada!', 'success');
        fecharModal();
        await carregarClientes();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

async function deletarCliente(id) {
    if (!confirm('Deletar esta cliente?')) return;
    try {
        const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
        if (error) throw error;
        showToast('🗑️ Cliente removida', 'success');
        await carregarClientes();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// ========== RENDER CLIENTES ==========
function renderClientes(filtro = '') {
    const container = document.getElementById('lista-clientes-container');
    if (!container) return;
    let clientes = clientesFiltrados();
    if (filtro) {
        const t = filtro.toLowerCase();
        clientes = clientes.filter(c => c.nome.toLowerCase().includes(t) || (c.unidade||'').toLowerCase().includes(t));
    }
    if (clientes.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h3>Nenhuma cliente</h3><p>${filtro ? 'Nenhum resultado para essa busca.' : grupoAtivo ? 'Nenhuma cliente neste grupo ainda.' : 'Adicione clientes para começar.'}</p></div>`;
        return;
    }
    let html = '';
    DIAS.forEach(dia => {
        const grupo = clientes.filter(c => c.dia === dia);
        if (!grupo.length) return;
        html += `<div class="day-group">
            <div class="day-group-header">
                <span class="day-name">${dia}-feira</span>
                <span class="day-count">${grupo.length} cliente${grupo.length > 1 ? 's' : ''}</span>
                <div class="day-line"></div>
            </div>
            <div class="client-list">${grupo.map(c => renderCard(c)).join('')}</div>
        </div>`;
    });
    const outros = clientes.filter(c => !DIAS.includes(c.dia));
    if (outros.length) {
        html += `<div class="day-group">
            <div class="day-group-header"><span class="day-name">Outros</span><span class="day-count">${outros.length}</span><div class="day-line"></div></div>
            <div class="client-list">${outros.map(c => renderCard(c)).join('')}</div>
        </div>`;
    }
    container.innerHTML = html;
}

function renderCard(c) {
    const statusClass = 'status-' + c.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const icone = getIconeStatus(c.status);
    const grupoTags = (c.grupos || []).map(gid => {
        const g = todosGrupos.find(x => x.id === gid);
        if (!g) return '';
        return `<span class="grupo-tag" style="color:${g.cor};border-color:${g.cor};background:${g.cor}18">${escapeHtml(g.nome)}</span>`;
    }).join('');

    return `<div class="client-card">
        <div class="client-main">
            <div class="client-name">${escapeHtml(c.nome)}</div>
            <div class="client-unidade">🏢 ${escapeHtml(c.unidade||'—')}</div>
            ${grupoTags ? `<div class="client-grupos">${grupoTags}</div>` : ''}
        </div>
        <div class="client-time">${c.horario||'—'}</div>
        <span class="status-badge ${statusClass}">${icone} ${c.status}</span>
        <div class="card-actions">
            <button class="btn-icon edit" onclick="abrirModalEditar(${c.id},'${escapeHtml(c.nome)}','${c.status}',${JSON.stringify(c.grupos||[])})" title="Editar">✏️</button>
            <button class="btn-icon delete" onclick="deletarCliente(${c.id})" title="Deletar">🗑️</button>
        </div>
    </div>`;
}

// ========== BUSCA ==========
function setupBusca() {
    document.getElementById('buscar-cliente')?.addEventListener('input', e => renderClientes(e.target.value));
}

// ========== MODAL EDITAR ==========
function setupModal() {
    document.getElementById('btn-salvar-status').addEventListener('click', salvarEdicaoCliente);
    document.getElementById('modal').addEventListener('click', function(e) { if (e.target === this) fecharModal(); });
}

function abrirModalEditar(id, nome, status, grupos) {
    clienteAtualId = id;
    document.getElementById('modal-cliente-nome').textContent = nome;
    document.getElementById('modal-status').value = status;
    renderGruposModal(grupos);
    document.getElementById('modal').classList.add('open');
}

function fecharModal() {
    document.getElementById('modal').classList.remove('open');
    clienteAtualId = null;
}

// ========== MODAL NOVO GRUPO ==========
function setupModalGrupo() {
    document.getElementById('btn-novo-grupo').addEventListener('click', abrirModalGrupo);
    document.getElementById('btn-salvar-grupo').addEventListener('click', async () => {
        const nome = document.getElementById('novo-grupo-nome').value.trim();
        if (!nome) { showToast('Digite um nome para o grupo', 'error'); return; }
        await criarGrupo(nome, corSelecionada);
        fecharModalGrupo();
        document.getElementById('novo-grupo-nome').value = '';
    });
    document.getElementById('modal-novo-grupo').addEventListener('click', function(e) {
        if (e.target === this) fecharModalGrupo();
    });
}

function renderCorPicker() {
    const picker = document.getElementById('cor-picker');
    picker.innerHTML = CORES.map(cor => `
        <div class="cor-option ${cor === corSelecionada ? 'selected' : ''}" data-cor="${cor}" style="background:${cor}"></div>
    `).join('');
    picker.querySelectorAll('.cor-option').forEach(opt => {
        opt.addEventListener('click', function() {
            corSelecionada = this.dataset.cor;
            picker.querySelectorAll('.cor-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

function abrirModalGrupo() {
    document.getElementById('modal-novo-grupo').classList.add('open');
    document.getElementById('novo-grupo-nome').focus();
}

function fecharModalGrupo() {
    document.getElementById('modal-novo-grupo').classList.remove('open');
}

// ========== ESTATÍSTICAS ==========
function atualizarEstatisticas() {
    const c = clientesFiltrados();
    setEl('total-clientes', c.length);
    setEl('total-pagos', c.filter(x => x.status==='Pago'||x.status==='Concluído').length);
    setEl('total-pendentes', c.filter(x => x.status==='Pendente').length);
    setEl('total-cancelados', c.filter(x => x.status==='Cancelado').length);
}

function atualizarRelatorios() {
    const c = clientesFiltrados();
    const total = c.length;
    const pagos = c.filter(x => x.status==='Pago'||x.status==='Concluído').length;
    const pendentes = c.filter(x => x.status==='Pendente').length;
    const taxa = total > 0 ? Math.round((pagos/total)*100) : 0;
    setEl('rel-total', total);
    setEl('rel-concluido', pagos);
    setEl('rel-pendente', pendentes);
    setEl('rel-taxa', taxa + '%');
}

// ========== GRÁFICOS ==========
function inicializarGraficos() {
    const ctxP = document.getElementById('chartPizza')?.getContext('2d');
    const ctxB = document.getElementById('chartBarra')?.getContext('2d');
    if (ctxP) {
        chartPizza = new Chart(ctxP, {
            type: 'doughnut',
            data: { labels: ['Concluídas','Pendentes','Canceladas'], datasets: [{ data:[0,0,0], backgroundColor:['#2dbd7a','#e8a020','#d94040'], borderColor:['#1a8a57','#b07818','#a02828'], borderWidth:2 }] },
            options: { responsive:true, cutout:'62%', plugins:{ legend:{ position:'bottom', labels:{ color:'#7a7a8c', font:{size:11}, padding:10 } } } }
        });
    }
    if (ctxB) {
        chartBarra = new Chart(ctxB, {
            type: 'bar',
            data: { labels:['Segunda','Terça','Quarta','Quinta'], datasets:[{ label:'Clientes', data:[0,0,0,0], backgroundColor:'rgba(201,168,76,0.65)', borderColor:'#c9a84c', borderWidth:1, borderRadius:6 }] },
            options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ ticks:{color:'#7a7a8c',stepSize:1}, grid:{color:'rgba(255,255,255,0.04)'}, border:{display:false} }, x:{ ticks:{color:'#7a7a8c'}, grid:{display:false}, border:{display:false} } } }
        });
    }
}

function atualizarGraficos() {
    const c = clientesFiltrados();
    if (chartPizza) {
        chartPizza.data.datasets[0].data = [
            c.filter(x=>x.status==='Pago'||x.status==='Concluído').length,
            c.filter(x=>x.status==='Pendente').length,
            c.filter(x=>x.status==='Cancelado').length
        ];
        chartPizza.update();
    }
    if (chartBarra) {
        chartBarra.data.datasets[0].data = DIAS.map(d => c.filter(x=>x.dia===d).length);
        chartBarra.update();
    }
}

// ========== FORM ==========
function setupForm() {
    document.getElementById('form-cliente')?.addEventListener('submit', adicionarCliente);
}

// ========== HELPERS ==========
function getIconeStatus(s) { return {'Pago':'✅','Concluído':'✅','Pendente':'⏳','Cancelado':'❌'}[s]||'❓'; }
function setEl(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function showToast(msg, type='success') {
    document.querySelector('.toast')?.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
