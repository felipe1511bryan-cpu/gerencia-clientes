// ========== CONFIGURAÇÃO SUPABASE ==========
const SUPABASE_URL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YnNwc3pwaG5sbmdxdmN3anVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDk3MDMsImV4cCI6MjA5NzgyNTcwM30.MKM-N5VM5oW9bdfgiakSaf3NKqgI1EesL-UdV0RfbWs';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YnNwc3pwaG5sbmdxdmN3anVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI0OTcwMywiZXhwIjoyMDk3ODI1NzAzfQ.8iCwKiMs4oClUXWSSPYX6SW3hk1UhWsFul1Fwz3rIIc';

// Evitar redeclaração
let supabase = null;
let clienteAtualId = null;
let clientes = [];

// Inicializar Supabase
if (window.supabase) {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    if (!supabase) {
        console.error('❌ Erro: Supabase não foi inicializado. Verifique a URL e a chave.');
        alert('Erro ao conectar ao banco de dados. Verifique o console.');
        return;
    }

    atualizarData();
    carregarClientes();
    inicializarGraficos();
    
    // Event Listeners de Menu
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            mudarSecao(this.dataset.section);
        });
    });

    // Event Listeners de Form
    document.getElementById('form-cliente').addEventListener('submit', adicionarCliente);
    document.getElementById('buscar-cliente').addEventListener('input', buscarCliente);

    // Modal
    document.querySelector('.close').addEventListener('click', fecharModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('modal');
        if (e.target === modal) fecharModal();
    });

    document.getElementById('btn-salvar-status').addEventListener('click', salvarStatusCliente);
});

// ========== FUNÇÕES DE NAVEGAÇÃO ==========
function mudarSecao(secao) {
    // Esconder todas as seções
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
    // Remover active de botões
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    // Mostrar seção ativa
    document.getElementById(secao).classList.add('active');
    event.target.classList.add('active');
    
    // Atualizar título
    const titulos = {
        'dashboard': '📊 Dashboard',
        'clientes': '👥 Clientes',
        'adicionar': '➕ Adicionar Cliente',
        'relatorios': '📈 Relatórios'
    };
    document.getElementById('page-title').textContent = titulos[secao];
}

function atualizarData() {
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const data = new Date().toLocaleDateString('pt-BR', opcoes);
    document.getElementById('data-atual').textContent = data;
}

// ========== OPERAÇÕES COM SUPABASE ==========
async function carregarClientes() {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar clientes:', error);
            throw error;
        }
        
        clientes = data || [];
        atualizarTabela();
        atualizarEstatisticas();
        atualizarGraficos();
    } catch (erro) {
        console.error('Erro ao carregar clientes:', erro);
        document.getElementById('tabela-clientes').innerHTML = 
            '<tr><td colspan="6" style="text-align: center; color: #e74c3c;">❌ Erro ao conectar. Verifique suas credenciais Supabase.</td></tr>';
    }
}

async function adicionarCliente(e) {
    e.preventDefault();

    const novoCliente = {
        nome: document.getElementById('nome').value,
        unidade: document.getElementById('unidade').value,
        dia: document.getElementById('dia').value,
        horario: document.getElementById('horario').value,
        status: document.getElementById('status').value,
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('clientes')
            .insert([novoCliente])
            .select();

        if (error) throw error;

        alert('✅ Cliente adicionado com sucesso!');
        document.getElementById('form-cliente').reset();
        mudarSecao('clientes');
        carregarClientes();
    } catch (erro) {
        console.error('Erro ao adicionar cliente:', erro);
        alert('❌ Erro ao adicionar cliente:\n' + erro.message);
    }
}

async function atualizarStatusCliente(id, novoStatus) {
    try {
        const { error } = await supabase
            .from('clientes')
            .update({ status: novoStatus })
            .eq('id', id);

        if (error) throw error;

        alert('✅ Status atualizado!');
        fecharModal();
        carregarClientes();
    } catch (erro) {
        console.error('Erro ao atualizar status:', erro);
        alert('❌ Erro ao atualizar status:\n' + erro.message);
    }
}

async function deletarCliente(id) {
    if (!confirm('Tem certeza que deseja deletar este cliente?')) return;

    try {
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ Cliente deletado!');
        carregarClientes();
    } catch (erro) {
        console.error('Erro ao deletar:', erro);
        alert('❌ Erro ao deletar cliente:\n' + erro.message);
    }
}

// ========== TABELA ==========
function atualizarTabela() {
    const tbody = document.getElementById('tabela-clientes');
    
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum cliente encontrado</td></tr>';
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
                <button class="btn-editar" onclick="abrirModalEditar(${cliente.id}, '${cliente.nome}', '${cliente.status}')">
                    ✏️ Editar
                </button>
                <button class="btn-deletar" onclick="deletarCliente(${cliente.id})">
                    🗑️ Deletar
                </button>
            </td>
        </tr>
    `).join('');
}

function buscarCliente() {
    const termo = document.getElementById('buscar-cliente').value.toLowerCase();
    const clientesFiltrados = clientes.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        c.unidade.toLowerCase().includes(termo)
    );

    const tbody = document.getElementById('tabela-clientes');
    
    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum cliente encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = clientesFiltrados.map(cliente => `
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
                <button class="btn-editar" onclick="abrirModalEditar(${cliente.id}, '${cliente.nome}', '${cliente.status}')">
                    ✏️ Editar
                </button>
                <button class="btn-deletar" onclick="deletarCliente(${cliente.id})">
                    🗑️ Deletar
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== MODAL ==========
function abrirModalEditar(id, nome, statusAtual) {
    clienteAtualId = id;
    document.getElementById('modal-cliente-nome').textContent = `Cliente: ${nome}`;
    document.getElementById('modal-status').value = statusAtual;
    document.getElementById('modal').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modal').style.display = 'none';
    clienteAtualId = null;
}

function salvarStatusCliente() {
    const novoStatus = document.getElementById('modal-status').value;
    atualizarStatusCliente(clienteAtualId, novoStatus);
}

// ========== ESTATÍSTICAS ==========
function atualizarEstatisticas() {
    const total = clientes.length;
    const pagos = clientes.filter(c => c.status === 'Pago').length;
    const concluidos = clientes.filter(c => c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const cancelados = clientes.filter(c => c.status === 'Cancelado').length;

    document.getElementById('total-clientes').textContent = total;
    document.getElementById('total-pagos').textContent = pagos + concluidos;
    document.getElementById('total-pendentes').textContent = pendentes;
    document.getElementById('total-cancelados').textContent = cancelados;

    // Relatórios
    document.getElementById('rel-total').textContent = total;
    document.getElementById('rel-concluido').textContent = pagos + concluidos;
    document.getElementById('rel-pendente').textContent = pendentes;
    const taxa = total > 0 ? Math.round(((pagos + concluidos) / total) * 100) : 0;
    document.getElementById('rel-taxa').textContent = taxa + '%';
}

// ========== GRÁFICOS ==========
let chartPizza = null;
let chartBarra = null;

function inicializarGraficos() {
    // Gráfico Pizza
    const ctxPizza = document.getElementById('chartPizza');
    if (!ctxPizza) return;
    
    const contexto1 = ctxPizza.getContext('2d');
    
    if (chartPizza) {
        chartPizza.destroy();
    }
    
    chartPizza = new Chart(contexto1, {
        type: 'doughnut',
        data: {
            labels: ['Pago/Concluído', 'Pendente', 'Cancelado'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#2ecc71',
                    '#f39c12',
                    '#e74c3c'
                ],
                borderColor: [
                    '#27ae60',
                    '#d68910',
                    '#c0392b'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#d4af37',
                        font: { size: 12, weight: 'bold' }
                    }
                }
            }
        }
    });

    // Gráfico Barra
    const ctxBarra = document.getElementById('chartBarra');
    if (!ctxBarra) return;
    
    const contexto2 = ctxBarra.getContext('2d');
    
    if (chartBarra) {
        chartBarra.destroy();
    }
    
    chartBarra = new Chart(contexto2, {
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
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#d4af37',
                        font: { size: 12, weight: 'bold' }
                    }
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

function atualizarGraficos() {
    if (!chartPizza || !chartBarra) return;

    // Pizza
    const pagos = clientes.filter(c => c.status === 'Pago' || c.status === 'Concluído').length;
    const pendentes = clientes.filter(c => c.status === 'Pendente').length;
    const cancelados = clientes.filter(c => c.status === 'Cancelado').length;

    chartPizza.data.datasets[0].data = [pagos, pendentes, cancelados];
    chartPizza.update();

    // Barra
    const segunda = clientes.filter(c => c.dia === 'Segunda').length;
    const terca = clientes.filter(c => c.dia === 'Terça').length;
    const quarta = clientes.filter(c => c.dia === 'Quarta').length;
    const quinta = clientes.filter(c => c.dia === 'Quinta').length;

    chartBarra.data.datasets[0].data = [segunda, terca, quarta, quinta];
    chartBarra.update();
}

// ========== FUNÇÕES AUXILIARES ==========
function getIconeStatus(status) {
    const iconesStatus = {
        'Pago': '✅',
        'Concluído': '✅',
        'Pendente': '⏳',
        'Cancelado': '❌'
    };
    return iconesStatus[status] || '❓';
}
