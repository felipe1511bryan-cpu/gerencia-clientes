// ========== CONFIGURAÇÃO SUPABASE ==========
const SUPABASE_URL = 'https://yxbizwnfqanlojydjanw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Yml6d25mcWFubG9qeWRqYW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTkxMjM0NTYsImV4cCI6MTg3Njg5MDI1Nn0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Yml6d25mcWFubG9qeWRqYW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTkxMjM0NTYsImV4cCI6MTg3Njg5MDI1Nn0';
// Inicializar Supabase apenas UMA VEZ
let supabaseClient = null;

if (typeof window !== 'undefined' && window.supabase) {
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Variáveis globais
let clienteAtualId = null;
let clientes = [];
let chartPizza = null;
let chartBarra = null;

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM carregado');
    
    if (!supabaseClient) {
        alert('❌ Erro: Supabase não conectado. Verifique a URL e chave.');
        return;
    }

    atualizarData();
    carregarClientes();
    inicializarGraficos();
    
    // Menu
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            mudarSecao(this.dataset.section);
        });
    });

    // Form
    const formCliente = document.getElementById('form-cliente');
    if (formCliente) {
        formCliente.addEventListener('submit', adicionarCliente);
    }

    // Busca
    const buscarInput = document.getElementById('buscar-cliente');
    if (buscarInput) {
        buscarInput.addEventListener('input', buscarCliente);
    }

    // Modal
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', fecharModal);
    }

    window.addEventListener('click', function(e) {
        const modal = document.getElementById('modal');
        if (e.target === modal) fecharModal();
    });

    const btnSalvar = document.getElementById('btn-salvar-status');
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarStatusCliente);
    }
});

// ========== NAVEGAÇÃO ==========
function mudarSecao(secao) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    const secaoEl = document.getElementById(secao);
    if (secaoEl) {
        secaoEl.classList.add('active');
    }
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    const titulos = {
        'dashboard': '📊 Dashboard',
        'clientes': '👥 Clientes',
        'adicionar': '➕ Adicionar Cliente',
        'relatorios': '📈 Relatórios'
    };
    
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
        titleEl.textContent = titulos[secao] || 'Gestor';
    }
}

function atualizarData() {
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const data = new Date().toLocaleDateString('pt-BR', opcoes);
    const dataEl = document.getElementById('data-atual');
    if (dataEl) {
        dataEl.textContent = data;
    }
}

// ========== SUPABASE OPERATIONS ==========
async function carregarClientes() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        clientes = data || [];
        console.log('✅ Clientes carregados:', clientes.length);
        
        atualizarTabela();
        atualizarEstatisticas();
        atualizarGraficos();
    } catch (erro) {
        console.error('❌ Erro ao carregar:', erro);
        const tbody = document.getElementById('tabela-clientes');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e74c3c;">Erro ao conectar ao banco</td></tr>';
        }
    }
}

async function adicionarCliente(e) {
    e.preventDefault();

    const novoCliente = {
        nome: document.getElementById('nome').value,
        unidade: document.getElementById('unidade').value,
        dia: document.getElementById('dia').value,
        horario: document.getElementById('horario').value,
        status: document.getElementById('status').value
    };

    try {
        const { error } = await supabaseClient
            .from('clientes')
            .insert([novoCliente]);

        if (error) throw error;

        alert('✅ Cliente adicionado!');
        document.getElementById('form-cliente').reset();
        mudarSecao('clientes');
        carregarClientes();
    } catch (erro) {
        console.error('❌ Erro:', erro);
        alert('Erro: ' + erro.message);
    }
}

async function atualizarStatusCliente(id, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from('clientes')
            .update({ status: novoStatus })
            .eq('id', id);

        if (error) throw error;

        alert('✅ Status atualizado!');
        fecharModal();
        carregarClientes();
    } catch (erro) {
        console.error('❌ Erro:', erro);
        alert('Erro: ' + erro.message);
    }
}

async function deletarCliente(id) {
    if (!confirm('Deletar este cliente?')) return;

    try {
        const { error } = await supabaseClient
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ Deletado!');
        carregarClientes();
    } catch (erro) {
        console.error('❌ Erro:', erro);
        alert('Erro: ' + erro.message);
    }
}

// ========== TABELA ==========
function atualizarTabela() {
    const tbody = document.getElementById('tabela-clientes');
    if (!tbody) return;
    
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum cliente</td></tr>';
        return;
    }

    tbody.innerHTML = clientes.map(cliente => `
        <tr>
            <td><strong>${cliente.nome}</strong></td>
            <td>${cliente.unidade}</td>
            <td>${cliente.dia}</td>
            <td>${cliente.horario}</td>
            <td>
                <span class="status status-${cliente.status.toLowerCase()}">
                    ${getIconeStatus(cliente.status)} ${cliente.status}
                </span>
            </td>
            <td>
                <button class="btn-editar" onclick="abrirModalEditar(${cliente.id}, '${cliente.nome}', '${cliente.status}')">✏️</button>
                <button class="btn-deletar" onclick="deletarCliente(${cliente.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function buscarCliente() {
    const termo = document.getElementById('buscar-cliente').value.toLowerCase();
    const filtrados = clientes.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        c.unidade.toLowerCase().includes(termo)
    );

    const tbody = document.getElementById('tabela-clientes');
    if (!tbody) return;
    
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum resultado</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(cliente => `
        <tr>
            <td><strong>${cliente.nome}</strong></td>
            <td>${cliente.unidade}</td>
            <td>${cliente.dia}</td>
            <td>${cliente.horario}</td>
            <td>
                <span class="status status-${cliente.status.toLowerCase()}">
                    ${getIconeStatus(cliente.status)} ${cliente.status}
                </span>
            </td>
            <td>
                <button class="btn-editar" onclick="abrirModalEditar(${cliente.id}, '${cliente.nome}', '${cliente.status}')">✏️</button>
                <button class="btn-deletar" onclick="deletarCliente(${cliente.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ========== MODAL ==========
function abrirModalEditar(id, nome, statusAtual) {
    clienteAtualId = id;
    const nomeEl = document.getElementById('modal-cliente-nome');
    const statusEl = document.getElementById('modal-status');
    
    if (nomeEl) nomeEl.textContent = `Cliente: ${nome}`;
    if (statusEl) statusEl.value = statusAtual;
    
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'block';
}

function fecharModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
    clienteAtualId = null;
}

function salvarStatusCliente() {
    const statusEl = document.getElementById('modal-status');
    if (statusEl && clienteAtualId) {
        atualizarStatusCliente(clienteAtualId, statusEl.value);
    }
}

// ========== ESTATÍSTICAS ==========
function atualizarEstatisticas() {
    const total = clientes.length;
    const pagos = clientes.filter(c => c.status === 'Pago' || c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const cancelados = clientes.filter(c => c.status === 'Cancelado').length;

    const elementos = {
        'total-clientes': total,
        'total-pagos': pagos,
        'total-pendentes': pendentes,
        'total-cancelados': cancelados,
        'rel-total': total,
        'rel-concluido': pagos,
        'rel-pendente': pendentes
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    });

    const taxa = total > 0 ? Math.round((pagos / total) * 100) : 0;
    const taxaEl = document.getElementById('rel-taxa');
    if (taxaEl) taxaEl.textContent = taxa + '%';
}

// ========== GRÁFICOS ==========
function inicializarGraficos() {
    // Pizza
    const canvasPizza = document.getElementById('chartPizza');
    if (canvasPizza) {
        const ctx1 = canvasPizza.getContext('2d');
        if (chartPizza) chartPizza.destroy();
        
        chartPizza = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Pago/Concluído', 'Pendente', 'Cancelado'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'],
                    borderColor: ['#27ae60', '#d68910', '#c0392b'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#d4af37', font: { size: 12, weight: 'bold' } }
                    }
                }
            }
        });
    }

    // Barra
    const canvasBarra = document.getElementById('chartBarra');
    if (canvasBarra) {
        const ctx2 = canvasBarra.getContext('2d');
        if (chartBarra) chartBarra.destroy();
        
        chartBarra = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Segunda', 'Terça', 'Quarta', 'Quinta'],
                datasets: [{
                    label: 'Clientes',
                    data: [0, 0, 0, 0],
                    backgroundColor: '#d4af37',
                    borderColor: '#e74c3c',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#d4af37', font: { size: 12, weight: 'bold' } }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: '#d4af37', stepSize: 1 },
                        grid: { color: 'rgba(212, 175, 55, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#d4af37' },
                        grid: { color: 'rgba(212, 175, 55, 0.1)' }
                    }
                }
            }
        });
    }
}

function atualizarGraficos() {
    if (!chartPizza || !chartBarra) return;

    const pagos = clientes.filter(c => c.status === 'Pago' || c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const cancelados = clientes.filter(c => c.status === 'Cancelado').length;

    chartPizza.data.datasets[0].data = [pagos, pendentes, cancelados];
    chartPizza.update();

    const segunda = clientes.filter(c => c.dia === 'Segunda').length;
    const terca = clientes.filter(c => c.dia === 'Terça').length;
    const quarta = clientes.filter(c => c.dia === 'Quarta').length;
    const quinta = clientes.filter(c => c.dia === 'Quinta').length;

    chartBarra.data.datasets[0].data = [segunda, terca, quarta, quinta];
    chartBarra.update();
}

// ========== AUXILIARES ==========
function getIconeStatus(status) {
    const icones = {
        'Pago': '✅',
        'Concluído': '✅',
        'Pendente': '⏳',
        'Cancelado': '❌'
    };
    return icones[status] || '❓';
}
