import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path


def criar_dashboard_unificado():
    """
    Cria um dashboard unificado com:
    - Análise de inventário (regras de risco)
    - Impacto financeiro
    - Visualizações interativas
    """
    
    df = pd.read_csv('skus.csv')
    
    current_date = datetime(2026, 3, 31)
    df['lastSaleDate'] = pd.to_datetime(df['lastSaleDate'], errors='coerce')
    
    # ==================== CÁLCULOS ====================
    
    # Regras de risco
    df['regra_bomba'] = (
        (df['dailySales30dAvg'] > 0)
        & (df['currentStock'] / df['dailySales30dAvg'] < df['leadTimeDays'])
    )
    
    df['regra_sazonal'] = (
        (df['seasonalIndex'] > 1.2)
        & (df['currentStock'] < df['reorderPoint'])
    )
    
    df['regra_zumbi'] = (
        (df['currentStock'] > 0)
        & (df['lastSaleDate'] <= (current_date - timedelta(days=60)))
    )
    
    # Score de risco
    def calcula_score(row):
        if row['regra_bomba']:
            score = 70
            if row['regra_sazonal']: 
                score += 15
            if row['marginPct'] > 40: 
                score += 15
            return min(100, score)
        elif row['regra_sazonal']:
            score = 45
            if row['marginPct'] > 40: 
                score += 15
            return min(100, score)
        elif row['regra_zumbi']:
            score = 40
            if row['marginPct'] > 40: 
                score += 15
            return min(100, score)
        else:
            if row['reorderPoint'] > 0:
                razao_estoque = row['currentStock'] / row['reorderPoint']
                if razao_estoque < 1:
                    return int(30 * (1 - razao_estoque))
                else:
                    return max(0, int(5 * (1 - min(razao_estoque - 1, 1))))
            else:
                if row['currentStock'] <= 5: 
                    return 20
                elif row['currentStock'] <= 10: 
                    return 10
                return 0
    
    df['score_risco'] = df.apply(calcula_score, axis=1)
    
    # Impacto financeiro
    df['margem_unitaria'] = df['unitPrice'] - df['unitCost']
    
    df['em_risco_falta'] = df['regra_bomba'] | df['regra_sazonal']
    
    def calcular_vendas_perdidas(row):
        if not row['em_risco_falta'] or pd.isna(row['dailySales30dAvg']):
            return 0
        if row['regra_bomba']:
            dias_sem_estoque = row['leadTimeDays']
            vendas_perdidas = row['dailySales30dAvg'] * dias_sem_estoque
            return vendas_perdidas
        return 0
    
    df['vendas_perdidas_unidades'] = df.apply(calcular_vendas_perdidas, axis=1)
    df['vendas_perdidas_lucro'] = df['vendas_perdidas_unidades'] * df['margem_unitaria']
    
    df['dinheiro_preso'] = df.apply(
        lambda row: row['currentStock'] * row['unitCost'] if row['regra_zumbi'] else 0,
        axis=1
    )
    
    df['lucro_perdido_zumbi'] = df.apply(
        lambda row: row['currentStock'] * row['margem_unitaria'] if row['regra_zumbi'] else 0,
        axis=1
    )
    
    df['impacto_total'] = df['vendas_perdidas_lucro'] + df['lucro_perdido_zumbi']
    
    # ==================== ESTATÍSTICAS ====================
    
    total_skus = len(df)
    regra_bomba_count = df['regra_bomba'].sum()
    regra_sazonal_count = df['regra_sazonal'].sum()
    regra_zumbi_count = df['regra_zumbi'].sum()
    
    alto_risco = len(df[df['score_risco'] >= 70])
    medio_risco = len(df[(df['score_risco'] >= 30) & (df['score_risco'] < 70)])
    baixo_risco = len(df[df['score_risco'] < 30])
    
    score_media = df['score_risco'].mean()
    score_max = df['score_risco'].max()
    
    # Impacto financeiro
    impacto_falta = df['vendas_perdidas_lucro'].sum()
    impacto_zumbi = df['lucro_perdido_zumbi'].sum()
    impacto_total = impacto_falta + impacto_zumbi
    
    # ==================== GERAR HTML ====================
    
    regras = ['Bomba', 'Sazonal', 'Zumbi']
    regras_counts = [regra_bomba_count, regra_sazonal_count, regra_zumbi_count]
    
    risco_labels = ['Alto Risco\n(≥70)', 'Médio Risco\n(30-69)', 'Baixo Risco\n(<30)']
    risco_counts = [alto_risco, medio_risco, baixo_risco]
    
    # Top 10 produtos por impacto
    top_produtos = df[df['impacto_total'] > 0].nlargest(10, 'impacto_total')
    top_produtos_html = top_produtos[[
        'skuId', 'skuName', 'score_risco', 'vendas_perdidas_lucro', 
        'lucro_perdido_zumbi', 'impacto_total'
    ]].to_html(index=False, classes="dataTable", table_id="topProdutosTable", escape=False)
    
    # Todos os produtos
    df_display = df[[
        'skuId', 'skuName', 'category', 'unitPrice', 'currentStock', 
        'reorderPoint', 'dailySales30dAvg', 'regra_bomba', 'regra_sazonal', 
        'regra_zumbi', 'score_risco', 'impacto_total'
    ]].sort_values('impacto_total', ascending=False)
    
    tabela_html = df_display.to_html(
        index=False,
        classes="dataTable",
        table_id="inventarioTable",
        escape=False,
    )
    
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dashboard Unificado - Inventário + Impacto Financeiro</title>
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css" />
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1600px;
            margin: 0 auto;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }}
        
        .header h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        
        .header p {{
            font-size: 1.1em;
            opacity: 0.9;
        }}
        
        .tabs {{
            display: flex;
            gap: 0;
            margin-bottom: 30px;
            border-radius: 12px 12px 0 0;
            overflow: hidden;
            background: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        
        .tab-button {{
            flex: 1;
            padding: 15px 20px;
            background: #e2e8f0;
            border: none;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s;
            color: #4a5568;
        }}
        
        .tab-button:hover {{
            background: #cbd5e0;
        }}
        
        .tab-button.active {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        
        .tab-content {{
            display: none;
            background: white;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 30px;
        }}
        
        .tab-content.active {{
            display: block;
        }}
        
        .dashboard {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }}
        
        .card {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s, box-shadow 0.3s;
        }}
        
        .card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 12px 16px rgba(0, 0, 0, 0.15);
        }}
        
        .card-label {{
            color: #718096;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }}
        
        .card-value {{
            font-size: 2.5em;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
        }}
        
        .card-subtext {{
            color: #a0aec0;
            font-size: 0.9em;
        }}
        
        .card.primary {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        
        .card.primary .card-label {{
            color: rgba(255, 255, 255, 0.7);
        }}
        
        .card.primary .card-value {{
            color: white;
        }}
        
        .card.primary .card-subtext {{
            color: rgba(255, 255, 255, 0.7);
        }}
        
        .card.danger {{
            border-left: 4px solid #e53e3e;
        }}
        
        .card.danger .card-value {{
            color: #e53e3e;
        }}
        
        .card.warning {{
            border-left: 4px solid #ed8936;
        }}
        
        .card.warning .card-value {{
            color: #ed8936;
        }}
        
        .card.success {{
            border-left: 4px solid #38a169;
        }}
        
        .card.success .card-value {{
            color: #38a169;
        }}
        
        .card.info {{
            border-left: 4px solid #4299e1;
        }}
        
        .card.info .card-value {{
            color: #4299e1;
        }}
        
        .charts-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }}
        
        .chart-container {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            position: relative;
            height: 350px;
        }}
        
        .chart-title {{
            font-size: 1.1em;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 15px;
        }}
        
        .table-container {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow-x: auto;
            margin-top: 20px;
        }}
        
        .table-title {{
            font-size: 1.2em;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
        }}
        
        table.dataTable {{
            width: 100% !important;
            border-collapse: collapse;
        }}
        
        table.dataTable thead th {{
            background-color: #f7fafc;
            color: #2d3748;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding: 12px;
            text-align: left;
        }}
        
        table.dataTable tbody td {{
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
        }}
        
        table.dataTable tbody tr:hover {{
            background-color: #f7fafc;
        }}
        
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }}
        
        .badge-true {{
            background-color: #fed7d7;
            color: #e53e3e;
        }}
        
        .badge-false {{
            background-color: #c6f6d5;
            color: #22543d;
        }}
        
        .score-badge {{
            display: inline-block;
            padding: 6px 10px;
            border-radius: 4px;
            font-weight: 600;
            color: white;
        }}
        
        .score-alto {{
            background-color: #e53e3e;
        }}
        
        .score-medio {{
            background-color: #ed8936;
        }}
        
        .score-baixo {{
            background-color: #38a169;
        }}
        
        .valor-grande {{
            color: #e53e3e;
            font-weight: bold;
            font-size: 1.2em;
        }}
        
        .dataTables_wrapper {{
            margin-top: 15px;
        }}
        
        .dataTables_filter {{
            margin-bottom: 15px;
        }}
        
        .dataTables_filter input {{
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }}
        
        @media (max-width: 768px) {{
            .tabs {{
                flex-wrap: wrap;
            }}
            
            .tab-button {{
                flex: 1 1 50%;
            }}
            
            .dashboard {{
                grid-template-columns: 1fr;
            }}
            
            .charts-row {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Dashboard Unificado</h1>
            <p>Análise Completa: Inventário + Impacto Financeiro (31 de março de 2026)</p>
        </div>
        
        <!-- ABAS -->
        <div class="tabs">
            <button class="tab-button active" onclick="abrirAba(event, 'inventario')">📦 Inventário</button>
            <button class="tab-button" onclick="abrirAba(event, 'impacto')">💰 Impacto Financeiro</button>
            <button class="tab-button" onclick="abrirAba(event, 'detalhes')">🔍 Detalhes Produtos</button>
        </div>
        
        <!-- ABA 1: INVENTÁRIO -->
        <div id="inventario" class="tab-content active">
            <div class="dashboard">
                <div class="card primary">
                    <div class="card-label">Total de SKUs</div>
                    <div class="card-value">{total_skus:,}</div>
                    <div class="card-subtext">Produtos em catálogo</div>
                </div>
                
                <div class="card danger">
                    <div class="card-icon">⚠️</div>
                    <div class="card-label">Alto Risco</div>
                    <div class="card-value">{alto_risco}</div>
                    <div class="card-subtext">{(alto_risco/total_skus*100):.1f}% do catálogo</div>
                </div>
                
                <div class="card warning">
                    <div class="card-icon">⚡</div>
                    <div class="card-label">Médio Risco</div>
                    <div class="card-value">{medio_risco}</div>
                    <div class="card-subtext">{(medio_risco/total_skus*100):.1f}% do catálogo</div>
                </div>
                
                <div class="card success">
                    <div class="card-icon">✅</div>
                    <div class="card-label">Baixo Risco</div>
                    <div class="card-value">{baixo_risco}</div>
                    <div class="card-subtext">{(baixo_risco/total_skus*100):.1f}% do catálogo</div>
                </div>
            </div>
            
            <div class="dashboard">
                <div class="card">
                    <div class="card-label">Score Médio</div>
                    <div class="card-value">{score_media:.2f}</div>
                    <div class="card-subtext">Escala de 0 a 100</div>
                </div>
                
                <div class="card">
                    <div class="card-label">Regra Bomba</div>
                    <div class="card-value">{regra_bomba_count}</div>
                    <div class="card-subtext">Risco de falta estoque</div>
                </div>
                
                <div class="card">
                    <div class="card-label">Regra Sazonal</div>
                    <div class="card-value">{regra_sazonal_count}</div>
                    <div class="card-subtext">Sazonais em risco</div>
                </div>
                
                <div class="card">
                    <div class="card-label">Produtos Zumbis</div>
                    <div class="card-value">{regra_zumbi_count}</div>
                    <div class="card-subtext">Sem vendas 60+ dias</div>
                </div>
            </div>
            
            <div class="charts-row">
                <div class="chart-container">
                    <div class="chart-title">📋 Distribuição por Regras</div>
                    <canvas id="chartRegras"></canvas>
                </div>
                
                <div class="chart-container">
                    <div class="chart-title">🎯 Classificação de Risco</div>
                    <canvas id="chartRisco"></canvas>
                </div>
            </div>
        </div>
        
        <!-- ABA 2: IMPACTO FINANCEIRO -->
        <div id="impacto" class="tab-content">
            <div style="background: linear-gradient(135deg, #f56565 0%, #ed8936 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 25px;">
                <h2 style="font-size: 2em; margin-bottom: 10px;">💥 IMPACTO FINANCEIRO TOTAL</h2>
                <div style="font-size: 3.5em; font-weight: bold; margin-top: 20px;">R$ {impacto_total:,.2f}</div>
                <p style="margin-top: 15px; font-size: 1.1em;">Quanto você deixaria de ganhar se não tomar cuidado com os dados</p>
            </div>
            
            <div class="dashboard">
                <div class="card danger">
                    <div class="card-label">⚠️ Perda por Falta de Estoque</div>
                    <div class="card-value">R$ {impacto_falta:,.2f}</div>
                    <div class="card-subtext">Vendas que não conseguiria fazer</div>
                </div>
                
                <div class="card warning">
                    <div class="card-label">🧟 Lucro Travado em Zumbis</div>
                    <div class="card-value">R$ {impacto_zumbi:,.2f}</div>
                    <div class="card-subtext">Produtos parados sem vender</div>
                </div>
                
                <div class="card info">
                    <div class="card-label">📊 Produtos Afetados</div>
                    <div class="card-value">{(df['regra_bomba'] | df['regra_sazonal']).sum() + regra_zumbi_count}</div>
                    <div class="card-subtext">Em risco ou parados</div>
                </div>
            </div>
            
            <div class="charts-row">
                <div class="chart-container">
                    <div class="chart-title">📈 Composição do Impacto</div>
                    <canvas id="chartImpacto"></canvas>
                </div>
            </div>
            
            <div class="table-container">
                <div class="table-title">🔴 Top 10 Produtos com Maior Impacto Financeiro</div>
                {top_produtos_html}
            </div>
        </div>
        
        <!-- ABA 3: DETALHES DOS PRODUTOS -->
        <div id="detalhes" class="tab-content">
            <div class="table-container">
                <div class="table-title">📊 Todos os Produtos - Dados Completos</div>
                <p style="color: #718096; margin-bottom: 15px;">Use busca, ordenação e paginação para explorar. Valores em vermelho = alto impacto</p>
                {tabela_html}
            </div>
        </div>
    </div>
    
    <script>
        // Função para mudar abas
        function abrirAba(evt, abaNome) {{
            var i, conteudo, botoes;
            
            conteudo = document.getElementsByClassName("tab-content");
            for (i = 0; i < conteudo.length; i++) {{
                conteudo[i].classList.remove("active");
            }}
            
            botoes = document.getElementsByClassName("tab-button");
            for (i = 0; i < botoes.length; i++) {{
                botoes[i].classList.remove("active");
            }}
            
            document.getElementById(abaNome).classList.add("active");
            evt.currentTarget.classList.add("active");
        }}
        
        // Gráfico de Regras
        const ctxRegras = document.getElementById('chartRegras').getContext('2d');
        new Chart(ctxRegras, {{
            type: 'bar',
            data: {{
                labels: {regras},
                datasets: [{{
                    label: 'Quantidade de Produtos',
                    data: {regras_counts},
                    backgroundColor: ['#ed8936', '#f6ad55', '#e53e3e'],
                    borderRadius: 8,
                    borderSkipped: false
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        display: false
                    }}
                }},
                scales: {{
                    y: {{
                        beginAtZero: true,
                        grid: {{
                            color: '#e2e8f0'
                        }}
                    }},
                    x: {{
                        grid: {{
                            display: false
                        }}
                    }}
                }}
            }}
        }});
        
        // Gráfico de Risco
        const ctxRisco = document.getElementById('chartRisco').getContext('2d');
        new Chart(ctxRisco, {{
            type: 'doughnut',
            data: {{
                labels: {risco_labels},
                datasets: [{{
                    data: {risco_counts},
                    backgroundColor: ['#e53e3e', '#ed8936', '#38a169'],
                    borderColor: 'white',
                    borderWidth: 2
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        position: 'bottom',
                        labels: {{
                            padding: 20,
                            font: {{
                                size: 12
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // Gráfico de Impacto
        const ctxImpacto = document.getElementById('chartImpacto').getContext('2d');
        new Chart(ctxImpacto, {{
            type: 'doughnut',
            data: {{
                labels: ['Perda por Falta de Estoque', 'Lucro Travado em Zumbis'],
                datasets: [{{
                    data: [{impacto_falta}, {impacto_zumbi}],
                    backgroundColor: ['#f56565', '#ed8936'],
                    borderColor: 'white',
                    borderWidth: 2
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        position: 'bottom',
                        labels: {{
                            padding: 20,
                            font: {{
                                size: 14
                            }},
                            usePointStyle: true
                        }}
                    }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                return 'R$ ' + context.parsed.toLocaleString('pt-BR', {{maximumFractionDigits: 0}});
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // DataTable - Top Produtos
        $(function () {{
            $('#topProdutosTable').DataTable({{
                paging: true,
                pageLength: 10,
                ordering: true,
                searching: true,
                info: true,
                autoWidth: false,
                language: {{
                    search: '🔍 Buscar:',
                    lengthMenu: 'Mostrar _MENU_ registros',
                    info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
                    paginate: {{
                        first: '«',
                        last: '»',
                        next: '›',
                        previous: '‹'
                    }}
                }},
                columnDefs: [{{
                    targets: [3, 4, 5],
                    render: function(data, type, row) {{
                        if (type === 'display') {{
                            return 'R$ ' + parseFloat(data).toLocaleString('pt-BR', {{maximumFractionDigits: 2}});
                        }}
                        return data;
                    }}
                }}]
            }});
        }});
        
        // DataTable - Todos os Produtos
        $(function () {{
            $('#inventarioTable').DataTable({{
                paging: true,
                pageLength: 20,
                lengthMenu: [[20, 50, 100], [20, 50, 100]],
                ordering: true,
                searching: true,
                info: true,
                autoWidth: false,
                language: {{
                    search: '🔍 Buscar:',
                    lengthMenu: 'Mostrar _MENU_ registros',
                    info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
                    paginate: {{
                        first: '«',
                        last: '»',
                        next: '›',
                        previous: '‹'
                    }}
                }},
                columnDefs: [
                    {{
                        targets: 11,
                        render: function(data, type, row) {{
                            if (type === 'display') {{
                                const value = parseFloat(data);
                                if (value > 0) {{
                                    return '<span class="valor-grande">R$ ' + value.toLocaleString('pt-BR', {{maximumFractionDigits: 0}}) + '</span>';
                                }}
                                return 'R$ 0';
                            }}
                            return data;
                        }}
                    }},
                    {{
                        targets: [7, 8, 9],
                        render: function(data) {{
                            return data === 'True' ? '<span class="badge badge-true">Sim</span>' : '<span class="badge badge-false">Não</span>';
                        }}
                    }},
                    {{
                        targets: 10,
                        render: function(data) {{
                            const score = parseInt(data);
                            if (score >= 70) return '<span class="score-badge score-alto">' + data + '</span>';
                            if (score >= 30) return '<span class="score-badge score-medio">' + data + '</span>';
                            return '<span class="score-badge score-baixo">' + data + '</span>';
                        }}
                    }}
                ]
            }});
        }});
    </script>
</body>
</html>
"""
    
    output_path = Path('dashboard_unificado.html')
    output_path.write_text(html, encoding='utf-8')
    print(f"\n✅ Dashboard Unificado criado com sucesso!")
    print(f"📁 Arquivo: {output_path.resolve()}\n")
    
    return df


if __name__ == '__main__':
    criar_dashboard_unificado()
