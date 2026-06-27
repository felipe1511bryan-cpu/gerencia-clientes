// ========== SUPABASE ==========
const SUPABASE_URL = 'https://yxbizwnfqanlojydjanw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Yml6d25mcWFubG9qeWRqYW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDI4NzEsImV4cCI6MjA5NzgxODg3MX0.QlH2vi52_6d-UzwxInKWOtRSwuPVEUnWOV8UbM_fHIM';

let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ========== STATE ==========
let todosClientes = [];
let clienteAtualId = null;
let semanaAtiva = 'atual'; // 'atual' | 'proxima'
let formSemana = 'atual';
let chartPizza = null;
let chartBarra = null;

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta'];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    if (!supabaseClient) {
        showToast('❌ Supabase não conectado', 'error');
        return;
    }

    atualizarData();
    carregarClientes();
    inicializarGraficos();
    setupNavegacao();
    setupForm();
    setupBusca();
    setupModal();
    setupWeekTabs();
    setupFormWeekBtns();
    setupMobile();
});

// ========== NAVEGAÇÃO ==========
function setupNavegacao() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            mudarSecao(this.dataset.section);
            // fechar sidebar no mobile
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('open');
        });
    });
}

function mudarSecao(secao) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const el = document.getElementById(secao);
    if (el) el.classList.add('active');

    const btn = document.querySelector(`.nav-btn[data-section="${secao}"]`);
    if (btn) btn.classList.add('active');

    const titulos = {
        dashboard: 'Dashboard',
        clientes: 'Clientes',
        adicionar: 'Adicionar Cliente',
        relatorios: 'Relatórios'
    };
    document.getElementById('page-title').textContent = titulos[secao] || 'Gestor';
}

// ========== WEEK TABS ==========
function setupWeekTabs() {
    document.querySelectorAll('.week-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            semanaAtiva = this.dataset.week;
            document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            atualizarWeekUI();
            renderClientes();
            atualizarEstatisticas();
            atualizarGraficos();
            atualizarRelatorios();
        });
    });
}

function atualizarWeekUI() {
    const badge = document.getElementById('week-badge');
    const clientesBadge = document.getElementById('clientes-week-badge');
    const relBadge = document.getElementById('relatorios-week-badge');

    if (semanaAtiva === 'atual') {
        badge.textContent = 'Semana Atual';
        badge.className = 'week-badge';
        if (clientesBadge) { clientesBadge.textContent = '📅 Semana Atual'; }
        if (relBadge) { relBadge.textContent = '📅 Semana Atual'; }
    } else {
        badge.textContent = 'Próxima Semana';
        badge.className = 'week-badge proxima';
        if (clientesBadge) { clientesBadge.textContent = '🔜 Próxima Semana'; }
        if (relBadge) { relBadge.textContent = '🔜 Próxima Semana'; }
    }
}

// ========== FORM WEEK BTNS ==========
function setupFormWeekBtns() {
    document.querySelectorAll('.week-select-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            formSemana = this.dataset.week;
            document.querySelectorAll('.week-select-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

// ========== MOBILE ==========
function setupMobile() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    });
}

// ========== DATA ==========
function atualizarData() {
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    document.getElementById('data-atual').textContent = new Date().toLocaleDateString('pt-BR', opts);
}

// ========== SUPABASE OPS ==========
async function carregarClientes() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('dia')
            .order('horario');

        if (error) throw error;
        todosClientes = data || [];
        renderClientes();
        atualizarEstatisticas();
        atualizarGraficos();
        atualizarRelatorios();
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar clientes', 'error');
    }
}

function clientesDaSemana() {
    // Se o campo "semana" não existir ainda na base, tratamos todos como "atual"
    return todosClientes.filter(c => {
        const s = c.semana || 'atual';
        return s === semanaAtiva;
    });
}

async function adicionarCliente(e) {
    e.preventDefault();

    const novoCliente = {
        nome: document.getElementById('nome').value.trim(),
        unidade: document.getElementById('unidade').value.trim(),
        dia: document.getElementById('dia').value,
        horario: document.getElementById('horario').value,
        status: document.getElementById('status').value,
        semana: formSemana
    };

    try {
        const { error } = await supabaseClient.from('clientes').insert([novoCliente]);
        if (error) throw error;
        showToast('✅ Cliente adicionada!', 'success');
        document.getElementById('form-cliente').reset();
        // reset week selection
        formSemana = semanaAtiva;
        document.querySelectorAll('.week-select-btn').forEach(b => b.classList.remove('selected'));
        document.querySelector(`.week-select-btn[data-week="${formSemana}"]`)?.classList.add('selected');
        await carregarClientes();
        mudarSecao('clientes');
    } catch (err) {
        console.error(err);
        showToast('Erro ao adicionar: ' + err.message, 'error');
    }
}

async function atualizarStatusCliente(id, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from('clientes')
            .update({ status: novoStatus })
            .eq('id', id);
        if (error) throw error;
        showToast('✅ Status atualizado!', 'success');
        fecharModal();
        await carregarClientes();
    } catch (err) {
        console.error(err);
        showToast('Erro: ' + err.message, 'error');
    }
}

async function moverParaProximaSemana(id) {
    const destino = clienteAtualSemana === 'atual' ? 'proxima' : 'atual';
    try {
        const { error } = await supabaseClient
            .from('clientes')
            .update({ semana: destino })
            .eq('id', id);
        if (error) throw error;
        showToast(`✅ Movida para ${destino === 'proxima' ? 'próxima semana' : 'semana atual'}!`, 'success');
        fecharModal();
        await carregarClientes();
    } catch (err) {
        console.error(err);
        showToast('Erro: ' + err.message, 'error');
    }
}

async function deletarCliente(id) {
    if (!confirm('Tem certeza que quer deletar esta cliente?')) return;
    try {
        const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
        if (error) throw error;
        showToast('🗑️ Cliente removida', 'success');
        await carregarClientes();
    } catch (err) {
        console.error(err);
        showToast('Erro: ' + err.message, 'error');
    }
}

// ========== RENDER CLIENTES ==========
function renderClientes(filtro = '') {
    const container = document.getElementById('lista-clientes-container');
    if (!container) return;

    let clientes = clientesDaSemana();

    if (filtro) {
        const t = filtro.toLowerCase();
        clientes = clientes.filter(c =>
            c.nome.toLowerCase().includes(t) ||
            (c.unidade || '').toLowerCase().includes(t)
        );
    }

    if (clientes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>Nenhuma cliente</h3>
                <p>${filtro ? 'Nenhum resultado para essa busca.' : 'Adicione clientes para esta semana.'}</p>
            </div>`;
        return;
    }

    // Agrupar por dia
    let html = '';
    DIAS.forEach(dia => {
        const grupo = clientes.filter(c => c.dia === dia);
        if (grupo.length === 0) return;

        html += `
        <div class="day-group">
            <div class="day-group-header">
                <span class="day-name">${dia}-feira</span>
                <span class="day-count">${grupo.length} cliente${grupo.length > 1 ? 's' : ''}</span>
                <div class="day-line"></div>
            </div>
            <div class="client-list">
                ${grupo.map(c => renderClientCard(c)).join('')}
            </div>
        </div>`;
    });

    // Clientes sem dia definido
    const semDia = clientes.filter(c => !DIAS.includes(c.dia));
    if (semDia.length > 0) {
        html += `
        <div class="day-group">
            <div class="day-group-header">
                <span class="day-name">Outros</span>
                <span class="day-count">${semDia.length}</span>
                <div class="day-line"></div>
            </div>
            <div class="client-list">
                ${semDia.map(c => renderClientCard(c)).join('')}
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

function renderClientCard(c) {
    const statusClass = 'status-' + c.status.toLowerCase().replace(/í/g,'i').replace(/ú/g,'u').replace(/ã/g,'a');
    const icone = getIconeStatus(c.status);
    return `
    <div class="client-card">
        <div class="client-main">
            <div class="client-name">${escapeHtml(c.nome)}</div>
            <div class="client-meta">
                <span>🏢 ${escapeHtml(c.unidade || '—')}</span>
            </div>
        </div>
        <div class="client-time">${c.horario || '—'}</div>
        <span class="status-badge ${statusClass}">${icone} ${c.status}</span>
        <div class="card-actions">
            <button class="btn-icon edit" onclick="abrirModalEditar(${c.id}, '${escapeHtml(c.nome)}', '${c.status}', '${c.semana || 'atual'}')" title="Editar">✏️</button>
            <button class="btn-icon delete" onclick="deletarCliente(${c.id})" title="Deletar">🗑️</button>
        </div>
    </div>`;
}

// ========== BUSCA ==========
function setupBusca() {
    const input = document.getElementById('buscar-cliente');
    if (input) {
        input.addEventListener('input', () => renderClientes(input.value));
    }
}

// ========== MODAL ==========
let clienteAtualSemana = 'atual';

function setupModal() {
    document.getElementById('btn-salvar-status').addEventListener('click', () => {
        const status = document.getElementById('modal-status').value;
        if (clienteAtualId) atualizarStatusCliente(clienteAtualId, status);
    });

    document.getElementById('btn-mover-semana').addEventListener('click', () => {
        if (clienteAtualId) moverParaProximaSemana(clienteAtualId);
    });

    document.getElementById('modal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
}

function abrirModalEditar(id, nome, status, semana) {
    clienteAtualId = id;
    clienteAtualSemana = semana || 'atual';

    document.getElementById('modal-cliente-nome').textContent = nome;
    document.getElementById('modal-status').value = status;

    // Botão de mover semana
    const btnMover = document.getElementById('btn-mover-semana');
    if (semana === 'atual') {
        btnMover.textContent = '🔜 Mover para Próxima Semana';
        btnMover.style.display = 'block';
    } else {
        btnMover.textContent = '📅 Mover para Semana Atual';
        btnMover.style.display = 'block';
    }

    document.getElementById('modal').classList.add('open');
}

function fecharModal() {
    document.getElementById('modal').classList.remove('open');
    clienteAtualId = null;
}

// ========== ESTATÍSTICAS ==========
function atualizarEstatisticas() {
    const clientes = clientesDaSemana();
    const total = clientes.length;
    const pagos = clientes.filter(c => c.status === 'Pago' || c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const cancelados = clientes.filter(c => c.status === 'Cancelado').length;

    setEl('total-clientes', total);
    setEl('total-pagos', pagos);
    setEl('total-pendentes', pendentes);
    setEl('total-cancelados', cancelados);
}

function atualizarRelatorios() {
    const clientes = clientesDaSemana();
    const total = clientes.length;
    const pagos = clientes.filter(c => c.status === 'Pago' || c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const taxa = total > 0 ? Math.round((pagos / total) * 100) : 0;

    setEl('rel-total', total);
    setEl('rel-concluido', pagos);
    setEl('rel-pendente', pendentes);
    setEl('rel-taxa', taxa + '%');
}

// ========== GRÁFICOS ==========
function inicializarGraficos() {
    const ctxPizza = document.getElementById('chartPizza')?.getContext('2d');
    const ctxBarra = document.getElementById('chartBarra')?.getContext('2d');

    if (ctxPizza) {
        chartPizza = new Chart(ctxPizza, {
            type: 'doughnut',
            data: {
                labels: ['Concluídas', 'Pendentes', 'Canceladas'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#2dbd7a', '#e8a020', '#d94040'],
                    borderColor: ['#1a8a57', '#b07818', '#a02828'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#7a7a8c', font: { size: 11 }, padding: 12 }
                    }
                }
            }
        });
    }

    if (ctxBarra) {
        chartBarra = new Chart(ctxBarra, {
            type: 'bar',
            data: {
                labels: ['Segunda', 'Terça', 'Quarta', 'Quinta'],
                datasets: [{
                    label: 'Clientes',
                    data: [0, 0, 0, 0],
                    backgroundColor: 'rgba(201, 168, 76, 0.7)',
                    borderColor: '#c9a84c',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        ticks: { color: '#7a7a8c', stepSize: 1 },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        border: { display: false }
                    },
                    x: {
                        ticks: { color: '#7a7a8c' },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }
}

function atualizarGraficos() {
    const clientes = clientesDaSemana();
    if (!chartPizza || !chartBarra) return;

    const pagos = clientes.filter(c => c.status === 'Pago' || c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const cancelados = clientes.filter(c => c.status === 'Cancelado').length;
    chartPizza.data.datasets[0].data = [pagos, pendentes, cancelados];
    chartPizza.update();

    chartBarra.data.datasets[0].data = DIAS.map(d => clientes.filter(c => c.dia === d).length);
    chartBarra.update();
}

// ========== FORM ==========
function setupForm() {
    document.getElementById('form-cliente')?.addEventListener('submit', adicionarCliente);
    // Sincronizar botão da semana com semana ativa
    document.querySelector(`.week-select-btn[data-week="${semanaAtiva}"]`)?.classList.add('selected');
}

// ========== HELPERS ==========
function getIconeStatus(status) {
    const m = { 'Pago': '✅', 'Concluído': '✅', 'Pendente': '⏳', 'Cancelado': '❌' };
    return m[status] || '❓';
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
        }
        
