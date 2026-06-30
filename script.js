// ========== SUPABASE ==========
const SUPABASE_URL = 'https://yxbizwnfqanlojydjanw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Yml6d25mcWFubG9qeWRqYW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDI4NzEsImV4cCI6MjA5NzgxODg3MX0.QlH2vi52_6d-UzwxInKWOtRSwuPVEUnWOV8UbM_fHIM';
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ========== STATE ==========
let todosClientes = [];
let todosProdutos = [];
let todosGrupos = [];
let grupoAtivo = null;
let clienteAtualId = null;
let chartPizza = null;
let chartBarra = null;
let corSelecionada = '#c9a84c';

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta'];
const CORES = ['#c9a84c','#2dbd7a','#3b82f6','#8b5cf6','#d94040','#e8a020','#ec4899','#06b6d4','#f97316','#84cc16'];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    if (!supabaseClient) { showToast('❌ Supabase não conectado', 'error'); return; }
    
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
    setupModalProduto();
    setupModalImportar();
    setupMobile();
    renderCorPicker();
    await carregarGrupos();
    await carregarClientes();
    await carregarProdutos();
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
    const titulos = { dashboard:'Dashboard', clientes:'Clientes', adicionar:'Adicionar Cliente', produtos:'Produtos', relatorios:'Relatórios' };
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
        const { data, error } = await supabaseClient.from('grupos').select('*').order('nome');
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
        const { error } = await supabaseClient.from('grupos').insert([{ nome: nome.trim(), cor }]);
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
        return `<label class="grupo-checkbox">
            <input type="checkbox" value="${g.id}" ${checked ? 'checked' : ''}>
            <span style="border-color:${g.cor};background:${g.cor}18;color:${g.cor}">${escapeHtml(g.nome)}</span>
        </label>`;
    }).join('');
}

function renderGruposModal(selecionados = []) {
    const el = document.getElementById('modal-grupos-list');
    if (!el) return;
    el.innerHTML = todosGrupos.map(g => {
        const checked = selecionados.includes(g.id);
        return `<label class="grupo-checkbox">
            <input type="checkbox" value="${g.id}" ${checked ? 'checked' : ''}>
            <span style="border-color:${g.cor};background:${g.cor}18;color:${g.cor}">${escapeHtml(g.nome)}</span>
        </label>`;
    }).join('');
}

function getGruposSelecionados(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return [];
    return Array.from(el.querySelectorAll('input:checked')).map(x => parseInt(x.value));
}

// ========== CLIENTES SUPABASE ==========
async function carregarClientes() {
    try {
        const { data, error } = await supabaseClient.from('clientes').select('*').order('dia').order('horario');
        if (error) throw error;
        todosClientes = data || [];
        atualizarTudo();
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar clientes', 'error');
    }
}

async function adicionarCliente(e) {
    e.preventDefault();
    const grupos = getGruposSelecionados('form-grupos-list');
    const novoCliente = {
        nome: document.getElementById('nome').value.trim(),
        unidade: document.getElementById('unidade').value.trim(),
        dia: document.getElementById('dia').value,
        horario: document.getElementById('horario').value,
        status: document.getElementById('status').value,
        grupos: grupos
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

async function deletarCliente(id) {
    if (!confirm('Deletar esta cliente?')) return;
    try {
        await supabaseClient.from('clientes').delete().eq('id', id);
        showToast('Cliente removida', 'success');
        await carregarClientes();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

async function salvarEdicaoCliente() {
    try {
        const novoStatus = document.getElementById('modal-status').value;
        const grupos = getGruposSelecionados('modal-grupos-list');
        await supabaseClient.from('clientes').update({ status: novoStatus, grupos }).eq('id', clienteAtualId);
        showToast('✅ Cliente atualizada!', 'success');
        fecharModal();
        await carregarClientes();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// ========== PRODUTOS SUPABASE ==========
async function carregarProdutos() {
    try {
        const { data, error } = await supabaseClient.from('produtos').select('*').order('nome');
        if (error) throw error;
        todosProdutos = data || [];
        verificarVencimentos();
        renderProdutos();
    } catch (err) {
        console.error('Erro produtos:', err);
    }
}

async function adicionarProduto() {
    const nome = document.getElementById('produto-nome')?.value.trim();
    const loja = parseInt(document.getElementById('produto-loja')?.value) || 0;
    const deposito = parseInt(document.getElementById('produto-deposito')?.value) || 0;
    const vencimento = document.getElementById('produto-vencimento')?.value;
    const unidade = document.getElementById('produto-unidade')?.value.trim() || 'unidades';
    
    if (!nome || !vencimento) {
        showToast('Preencha nome e data de vencimento', 'error');
        return;
    }
    
    try {
        const { error } = await supabaseClient.from('produtos').insert([{ 
            nome, 
            loja, 
            deposito,
            vencimento,
            unidade
        }]);
        if (error) throw error;
        showToast('✅ Produto adicionado!', 'success');
        document.getElementById('produto-nome').value = '';
        document.getElementById('produto-loja').value = '0';
        document.getElementById('produto-deposito').value = '0';
        document.getElementById('produto-vencimento').value = '';
        document.getElementById('produto-unidade').value = '';
        await carregarProdutos();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

async function deletarProduto(id) {
    if (!confirm('Deletar este produto?')) return;
    try {
        await supabaseClient.from('produtos').delete().eq('id', id);
        showToast('Produto removido', 'success');
        await carregarProdutos();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

function verificarVencimentos() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    todosProdutos.forEach(p => {
        const dataVenc = new Date(p.vencimento);
        dataVenc.setHours(0, 0, 0, 0);
        const diasRestantes = Math.floor((dataVenc - hoje) / (1000 * 60 * 60 * 24));
        
        if (diasRestantes < 0) {
            p.status = 'vencido';
            p.dias = 'VENCIDO';
        } else if (diasRestantes <= 20) {
            p.status = 'aviso';
            p.dias = `${diasRestantes}d`;
        } else {
            p.status = 'ok';
            p.dias = `${diasRestantes}d`;
        }
    });
}

function renderProdutos() {
    const container = document.getElementById('produtos-container');
    if (!container) return;
    
    if (todosProdutos.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><h3>Nenhum produto</h3><p>Adicione produtos para começar.</p></div>';
        return;
    }
    
    let html = '';
    todosProdutos.forEach(p => {
        const total = p.loja + p.deposito;
        const statusClass = p.status || 'ok';
        const unidade = p.unidade || 'unidades';
        const dataVenc = new Date(p.vencimento).toLocaleDateString('pt-BR');
        html += `<div class="produto-card ${statusClass}">
            <div class="produto-header">
                <div class="produto-nome">${escapeHtml(p.nome)}</div>
                <div class="produto-dias ${statusClass}">${p.dias || '—'}</div>
            </div>
            <div class="produto-validade">📅 Vence: ${dataVenc} • 📦 ${escapeHtml(unidade)}</div>
            <div class="produto-info">
                <div class="produto-info-item">
                    <span class="label">Loja</span>
                    <span class="value">${p.loja}</span>
                </div>
                <div class="produto-info-item">
                    <span class="label">Depósito</span>
                    <span class="value">${p.deposito}</span>
                </div>
                <div class="produto-info-item total">
                    <span class="label">Total</span>
                    <span class="value">${total}</span>
                </div>
            </div>
            <div class="produto-actions">
                <button class="btn-icon edit" onclick="abrirModalEditarProduto(${p.id},'${escapeHtml(p.nome)}',${p.loja},${p.deposito},'${p.vencimento}','${escapeHtml(unidade)}')">✏️</button>
                <button class="btn-icon delete" onclick="deletarProduto(${p.id})">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function setupModalProduto() {
    const btn = document.getElementById('btn-adicionar-produto');
    if (btn) {
        btn.addEventListener('click', adicionarProduto);
    }
    
    const modalProd = document.getElementById('modal-editar-produto');
    if (modalProd) {
        modalProd.addEventListener('click', function(e) { 
            if (e.target === this) fecharModalProduto(); 
        });
    }
    
    const btnSalvar = document.getElementById('btn-salvar-produto');
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarEdicaoProduto);
    }
}

let produtoEditandoId = null;

function abrirModalEditarProduto(id, nome, loja, deposito, vencimento, unidade) {
    produtoEditandoId = id;
    document.getElementById('edit-produto-nome').textContent = nome;
    document.getElementById('edit-produto-loja').value = loja;
    document.getElementById('edit-produto-deposito').value = deposito;
    document.getElementById('edit-produto-vencimento').value = vencimento;
    document.getElementById('edit-produto-unidade').value = unidade || 'unidades';
    document.getElementById('modal-editar-produto').classList.add('open');
}

function fecharModalProduto() {
    document.getElementById('modal-editar-produto').classList.remove('open');
    produtoEditandoId = null;
}

async function salvarEdicaoProduto() {
    if (!produtoEditandoId) return;
    
    const loja = parseInt(document.getElementById('edit-produto-loja').value) || 0;
    const deposito = parseInt(document.getElementById('edit-produto-deposito').value) || 0;
    const vencimento = document.getElementById('edit-produto-vencimento').value;
    const unidade = document.getElementById('edit-produto-unidade').value.trim() || 'unidades';
    
    if (!vencimento) {
        showToast('Preencha a data de vencimento', 'error');
        return;
    }
    
    try {
        const { error } = await supabaseClient.from('produtos').update({ 
            loja, 
            deposito,
            vencimento,
            unidade
        }).eq('id', produtoEditandoId);
        
        if (error) throw error;
        showToast('✅ Produto atualizado!', 'success');
        fecharModalProduto();
        await carregarProdutos();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// ========== RENDERIZAR CLIENTES ==========
function atualizarTudo() {
    renderClientes();
    atualizarEstatisticas();
    atualizarRelatorios();
    atualizarGraficos();
}

function clientesFiltrados() {
    let clientes = todosClientes;
    if (grupoAtivo) {
        clientes = clientes.filter(c => (c.grupos || []).includes(grupoAtivo));
    }
    return clientes;
}

function renderClientes(filtro = '') {
    const container = document.getElementById('lista-clientes-container');
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

// ========== IMPORTAR VALIDADES EM MASSA ==========
function abrirModalImportar() {
    document.getElementById('modal-importar-validades').classList.add('open');
    document.getElementById('textarea-importar').focus();
}

function fecharModalImportar() {
    document.getElementById('modal-importar-validades').classList.remove('open');
}

async function processarImportacao() {
    const texto = document.getElementById('textarea-importar').value.trim();
    if (!texto) {
        showToast('Cole o texto das validades', 'error');
        return;
    }
    
    const produtos = extrairProdutosDoTexto(texto);
    if (produtos.length === 0) {
        showToast('Nenhum produto encontrado. Verifique o formato.', 'error');
        return;
    }
    
    try {
        for (const prod of produtos) {
            await supabaseClient.from('produtos').insert([prod]);
        }
        showToast(`✅ ${produtos.length} produtos importados!`, 'success');
        document.getElementById('textarea-importar').value = '';
        fecharModalImportar();
        await carregarProdutos();
    } catch (err) {
        showToast('Erro ao importar: ' + err.message, 'error');
    }
}

function extrairProdutosDoTexto(texto) {
    const produtos = [];
    const linhas = texto.split('\n');
    let produtoAtual = null;
    let datas = [];

    const REGEX_DATA = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;

    function salvarProdutoAtual() {
        if (produtoAtual && datas.length > 0) {
            produtos.push(...criarVariacoesDoProduto(produtoAtual, datas));
        }
    }

    for (let linha of linhas) {
        linha = linha.trim();
        if (!linha) continue;

        // Extrai todas as datas DD/MM/YYYY presentes na linha
        const datasDaLinha = [];
        let match;
        REGEX_DATA.lastIndex = 0;
        while ((match = REGEX_DATA.exec(linha)) !== null) {
            datasDaLinha.push(`${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`);
        }

        // O que sobra da linha depois de remover emoji, datas e separadores é o nome do produto (se houver)
        const nomeNaLinha = linha
            .replace(/^[🍺🍹🥤]\s*/u, '')
            .replace(REGEX_DATA, '')
            .replace(/[-–—:|]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (nomeNaLinha) {
            // Linha com nome de produto (ex: "🍺 Skol" ou "Skol - 23/01/2027")
            salvarProdutoAtual();
            produtoAtual = nomeNaLinha;
            datas = [...datasDaLinha];
        } else if (datasDaLinha.length > 0) {
            // Linha contém só data(s), associa ao produto atual em construção
            datas.push(...datasDaLinha);
        }
    }

    salvarProdutoAtual();
    return produtos;
}

function criarVariacoesDoProduto(nome, datas) {
    // Remove duplicatas de datas
    const datasUnicas = [...new Set(datas)];
    
    // Se tem múltiplas datas, cria um produto para cada
    if (datasUnicas.length > 1) {
        return datasUnicas.map(data => ({
            nome: nome,
            loja: 1,
            deposito: 0,
            vencimento: data
        }));
    }
    
    // Se tem só uma data, cria um único produto
    return [{
        nome: nome,
        loja: 1,
        deposito: 0,
        vencimento: datasUnicas[0]
    }];
}

// ========== COPIAR PRODUTOS PARA TEXTO ==========
function copiarProdutosTexto() {
    if (todosProdutos.length === 0) {
        showToast('Nenhum produto para copiar', 'error');
        return;
    }

    // Agrupa por nome do produto, juntando todas as validades dele
    const grupos = {};
    todosProdutos.forEach(p => {
        if (!grupos[p.nome]) grupos[p.nome] = [];
        grupos[p.nome].push(p.vencimento);
    });

    const linhas = Object.entries(grupos).map(([nome, datas]) => {
        const datasBR = datas
            .slice()
            .sort()
            .map(d => {
                const [ano, mes, dia] = d.split('-');
                return `${dia}/${mes}/${ano}`;
            })
            .join('  ');
        return `${nome} - ${datasBR}`;
    });

    const texto = linhas.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto)
            .then(() => showToast('📋 Produtos copiados! Cole onde quiser editar.', 'success'))
            .catch(() => showToast('Erro ao copiar para a área de transferência', 'error'));
    } else {
        showToast('Seu navegador não suporta copiar automaticamente', 'error');
    }
}

function setupModalImportar() {
    const btn = document.getElementById('btn-importar-validades');
    if (btn) {
        btn.addEventListener('click', abrirModalImportar);
    }
    
    const btnConfirmar = document.getElementById('btn-confirmar-importacao');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', processarImportacao);
    }
    
    const modal = document.getElementById('modal-importar-validades');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) fecharModalImportar();
        });
    }
}
// ========== AGRUPAMENTO DE PRODUTOS (por nome, somando por embalagem) ==========
function agruparProdutosPorNome(produtos, campoQtd) {
    const rank = { vencido: 2, aviso: 1, ok: 0 };
    const mapa = {};

    produtos.forEach(p => {
        const qtd = p[campoQtd] || 0;
        if (qtd <= 0) return;
        if (!mapa[p.nome]) {
            mapa[p.nome] = { nome: p.nome, total: 0, unidades: {}, piorStatus: 'ok', proximaValidade: p.vencimento, qtdValidades: 0 };
        }
        const g = mapa[p.nome];
        const unidade = p.unidade || 'unidades';
        g.total += qtd;
        g.unidades[unidade] = (g.unidades[unidade] || 0) + qtd;
        g.qtdValidades += 1;
        if ((rank[p.status] || 0) > rank[g.piorStatus]) g.piorStatus = p.status;
        if (new Date(p.vencimento) < new Date(g.proximaValidade)) g.proximaValidade = p.vencimento;
    });

    return Object.values(mapa)
        .map(g => ({ ...g, partes: Object.entries(g.unidades).map(([unidade, qtd]) => ({ unidade, qtd })) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function formatarDataBR(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

// ========== MENSAGEM WHATSAPP ==========
function linhaGrupoWhatsApp(g) {
    const emoji = g.piorStatus === 'vencido' ? '❌' : g.piorStatus === 'aviso' ? '⚠️' : '✅';
    const partesTxt = g.partes.map(pt => `${pt.qtd.toLocaleString('pt-BR')} ${pt.unidade}`).join(', ');
    let linha = `${emoji} *${g.nome}*: ${partesTxt}`;
    if (g.piorStatus !== 'ok') {
        linha += `  _(val. ${formatarDataBR(g.proximaValidade)})_`;
    }
    return linha;
}

function blocoSecaoWhatsApp(titulo, total, grupos, vazioMsg) {
    let bloco = `${titulo}\n`;
    bloco += `Total: *${total.toLocaleString('pt-BR')} unidades*\n\n`;
    bloco += `📋 *Produtos:*\n`;
    bloco += grupos.length === 0 ? `_${vazioMsg}_\n` : grupos.map(linhaGrupoWhatsApp).join('\n') + '\n';
    return bloco;
}

function gerarMensagemWhatsApp() {
    if (todosProdutos.length === 0) {
        showToast('Nenhum produto para exportar', 'error');
        return;
    }

    const totalLoja = todosProdutos.reduce((sum, p) => sum + p.loja, 0);
    const totalDeposito = todosProdutos.reduce((sum, p) => sum + p.deposito, 0);
    const totalGeral = totalLoja + totalDeposito;

    const gruposLoja = agruparProdutosPorNome(todosProdutos, 'loja');
    const gruposDeposito = agruparProdutosPorNome(todosProdutos, 'deposito');

    let mensagem = `📦 *RELATÓRIO DE ESTOQUE*\n`;
    mensagem += `_${new Date().toLocaleDateString('pt-BR')}_\n`;
    mensagem += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;

    mensagem += blocoSecaoWhatsApp('🏪 *LOJA*', totalLoja, gruposLoja, 'Nenhum produto em loja');
    mensagem += `\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;
    mensagem += blocoSecaoWhatsApp('🏢 *DEPÓSITO*', totalDeposito, gruposDeposito, 'Nenhum produto em depósito');

    mensagem += `\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;
    mensagem += `📦 *TOTAL GERAL: ${totalGeral.toLocaleString('pt-BR')} unidades*\n`;
    mensagem += `_❌ vencido · ⚠️ vence em até 20 dias · ✅ ok_`;

    const texto = encodeURIComponent(mensagem);
    window.open(`https://wa.me/?text=${texto}`, '_blank');
    showToast('✅ Mensagem preparada no WhatsApp', 'success');
}

// ========== GERAR PDF ==========
function gerarPDF() {
    if (todosProdutos.length === 0) {
        showToast('Nenhum produto para gerar PDF', 'error');
        return;
    }
    
    const totalLoja = todosProdutos.reduce((sum, p) => sum + p.loja, 0);
    const totalDeposito = todosProdutos.reduce((sum, p) => sum + p.deposito, 0);
    const totalGeral = totalLoja + totalDeposito;

    const statusClassOf = g => g.piorStatus === 'vencido' ? 'status-vencido' : g.piorStatus === 'aviso' ? 'status-aviso' : 'status-ok';
    const statusTextOf = g => g.piorStatus === 'vencido' ? 'VENCIDO' : g.piorStatus === 'aviso' ? 'ATENÇÃO' : 'OK';

    function tabelaSecao(grupos) {
        if (grupos.length === 0) {
            return `<p class="empty-msg">Nenhum produto nesta seção.</p>`;
        }
        return `
            <table>
                <thead>
                    <tr><th>Produto</th><th>Quantidade</th><th>Validade</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${grupos.map(g => {
                        const partesTxt = g.partes.map(pt => `<strong>${pt.qtd.toLocaleString('pt-BR')}</strong> ${escapeHtml(pt.unidade)}`).join(', ');
                        const dataFmt = formatarDataBR(g.proximaValidade);
                        const validadeTxt = g.qtdValidades > 1
                            ? `${dataFmt} <span class="multi-tag">+${g.qtdValidades - 1} validade${g.qtdValidades - 1 > 1 ? 's' : ''}</span>`
                            : dataFmt;
                        return `
                        <tr class="linha-${statusClassOf(g)}">
                            <td><strong>${escapeHtml(g.nome)}</strong></td>
                            <td>${partesTxt}</td>
                            <td>${validadeTxt}</td>
                            <td><span class="${statusClassOf(g)}">${statusTextOf(g)}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    }

    const produtosLoja = agruparProdutosPorNome(todosProdutos, 'loja');
    const produtosDeposito = agruparProdutosPorNome(todosProdutos, 'deposito');
    
    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Estoque</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                .header { text-align: center; margin-bottom: 24px; }
                .header h1 { color: #333; margin: 0; font-size: 28px; }
                .header p { color: #666; margin: 5px 0; }
                .summary { background: #c9a84c; color: white; padding: 16px; border-radius: 8px; margin-bottom: 28px; text-align: center; }
                .summary h2 { margin: 0 0 8px; font-size: 22px; }
                .summary .breakdown { display: flex; justify-content: center; gap: 24px; font-size: 14px; }
                .section-title { display: flex; align-items: center; gap: 8px; font-size: 18px; color: #333; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #c9a84c; }
                .section-total { font-size: 13px; color: #666; margin-bottom: 12px; }
                table { width: 100%; border-collapse: collapse; background: white; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 6px; overflow: hidden; }
                th { background: #2b2b33; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 13px; }
                td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
                tr:last-child td { border-bottom: none; }
                tr:hover { background: #f9f9f9; }
                tr.linha-status-ok { border-left: 4px solid #2dbd7a; }
                tr.linha-status-aviso { border-left: 4px solid #e8a020; background: #fffaf0; }
                tr.linha-status-vencido { border-left: 4px solid #d94040; background: #fff5f5; }
                .multi-tag { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: bold; color: #666; background: #eee; padding: 2px 6px; border-radius: 10px; }
                .empty-msg { color: #999; font-style: italic; font-size: 13px; margin-bottom: 16px; }
                .status-ok { color: #2dbd7a; font-weight: bold; }
                .status-aviso { color: #e8a020; font-weight: bold; }
                .status-vencido { color: #d94040; font-weight: bold; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📦 Relatório de Estoque</h1>
                <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            
            <div class="summary">
                <h2>Total Geral: ${totalGeral.toLocaleString('pt-BR')} unidades</h2>
                <div class="breakdown">
                    <span>🏪 Loja: ${totalLoja.toLocaleString('pt-BR')}</span>
                    <span>🏢 Depósito: ${totalDeposito.toLocaleString('pt-BR')}</span>
                </div>
            </div>

            <div class="section-title">🏪 Loja</div>
            <div class="section-total">Total: <strong>${totalLoja.toLocaleString('pt-BR')}</strong> unidades</div>
            ${tabelaSecao(produtosLoja)}

            <div class="section-title">🏢 Depósito</div>
            <div class="section-total">Total: <strong>${totalDeposito.toLocaleString('pt-BR')}</strong> unidades</div>
            ${tabelaSecao(produtosDeposito)}
            
            <div class="footer">
                <p>Este relatório foi gerado automaticamente pelo GESTOR</p>
            </div>
        </body>
        </html>
    `;
    
    const novaJanela = window.open('', '_blank');
    novaJanela.document.write(html);
    novaJanela.document.close();
    novaJanela.print();
    showToast('✅ PDF aberto para impressão', 'success');
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
