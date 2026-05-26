import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path


def gerar_html_interativo(df):
    # Calcular estatísticas para os cards
    total_skus = len(df)
    regra_bomba_count = df['regra_bomba'].sum()
    regra_sazonal_count = df['regra_sazonal'].sum()
    regra_zumbi_count = df['regra_zumbi'].sum()
    
    score_min = df['score_risco'].min()
    score_max = df['score_risco'].max()
    score_media = df['score_risco'].mean()
    
    # Distribuição de risco
    alto_risco = len(df[df['score_risco'] >= 70])
    medio_risco = len(df[(df['score_risco'] >= 30) & (df['score_risco'] < 70)])
    baixo_risco = len(df[df['score_risco'] < 30])
    
    # Dados para gráficos
    regras = ['Bomba', 'Sazonal', 'Zumbi']
    regras_counts = [regra_bomba_count, regra_sazonal_count, regra_zumbi_count]
    
    risco_labels = ['Alto Risco\n(≥70)', 'Médio Risco\n(30-69)', 'Baixo Risco\n(<30)']
    risco_counts = [alto_risco, medio_risco, baixo_risco]
    
    tabela_html = df.to_html(
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
    <title>Dashboard de Inventário - 31 de março de 2026</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        .header {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 25px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        
        .header h1 {{
            color: #2d3748;
            font-size: 2em;
            margin-bottom: 8px;
        }}
        
        .header p {{
            color: #718096;
            font-size: 1em;
        }}
        
        .timestamp {{
            color: #a0aec0;
            font-size: 0.9em;
            margin-top: 10px;
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
        
        .card-icon {{
            font-size: 2.5em;
            margin-bottom: 10px;
            opacity: 0.6;
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
        }}
        
        .table-title {{
            font-size: 1.3em;
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
        
        .dataTables_paginate {{
            margin-top: 15px;
        }}
        
        .paginate_button {{
            padding: 6px 10px;
            margin: 2px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            transition: all 0.3s;
        }}
        
        .paginate_button:hover {{
            background-color: #f7fafc;
            border-color: #667eea;
        }}
        
        .paginate_button.current {{
            background-color: #667eea;
            color: white;
            border-color: #667eea;
        }}
        
        @media (max-width: 768px) {{
            .dashboard {{
                grid-template-columns: 1fr;
            }}
            
            .charts-row {{
                grid-template-columns: 1fr;
            }}
            
            .header {{
                padding: 20px;
            }}
            
            .header h1 {{
                font-size: 1.5em;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Dashboard de Inventário</h1>
            <p>Análise de Risco e Status de Estoque - Snapshot 31 de Março de 2026</p>
            <div class="timestamp">Última atualização: 31 de março de 2026</div>
        </div>
        
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
                <div class="card-label">Score de Risco Médio</div>
                <div class="card-value">{score_media:.2f}</div>
                <div class="card-subtext">Escala de 0 a 100</div>
            </div>
            
            <div class="card">
                <div class="card-label">Score Máximo</div>
                <div class="card-value">{score_max:.0f}</div>
                <div class="card-subtext">Risco mais alto detectado</div>
            </div>
            
            <div class="card">
                <div class="card-label">Regra Bomba</div>
                <div class="card-value">{regra_bomba_count}</div>
                <div class="card-subtext">Risco de falta de estoque</div>
            </div>
            
            <div class="card">
                <div class="card-label">Produtos Zumbis</div>
                <div class="card-value">{regra_zumbi_count}</div>
                <div class="card-subtext">Sem vendas há 60+ dias</div>
            </div>
        </div>
        
        <div class="charts-row">
            <div class="chart-container">
                <div class="chart-title">📋 Distribuição por Regras de Risco</div>
                <canvas id="chartRegras"></canvas>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">🎯 Classificação de Risco</div>
                <canvas id="chartRisco"></canvas>
            </div>
        </div>
        
        <div class="table-container">
            <div class="table-title">📈 Tabela Completa de Produtos</div>
            <p style="color: #718096; margin-bottom: 15px;">Use a busca, ordenação e paginação para explorar os dados</p>
            {tabela_html}
        </div>
    </div>
    
    <script>
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
        
        // DataTable initialization
        $(function () {{
            $('#inventarioTable').DataTable({{
                paging: true,
                pageLength: 15,
                lengthMenu: [[15, 25, 50, 100], [15, 25, 50, 100]],
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
                    targets: -1,
                    render: function(data, type, row) {{
                        if (type === 'display') {{
                            const score = parseInt(data);
                            if (score >= 70) return '<span class="score-badge score-alto">' + data + '</span>';
                            if (score >= 30) return '<span class="score-badge score-medio">' + data + '</span>';
                            return '<span class="score-badge score-baixo">' + data + '</span>';
                        }}
                        return data;
                    }}
                }}]
            }});
        }});
    </script>
</body>
</html>
"""

    return html


def main():
    df = pd.read_csv('skus.csv')

    current_date = datetime(2026, 3, 31)
    df['lastSaleDate'] = pd.to_datetime(df['lastSaleDate'], errors='coerce')

    # 1. Regra Bomba: True se (currentStock / dailySales30dAvg) < leadTimeDays
    df['regra_bomba'] = (
        (df['dailySales30dAvg'] > 0)
        & (df['currentStock'] / df['dailySales30dAvg'] < df['leadTimeDays'])
    )

    # 2. Regra Sazonal: True se seasonalIndex > 1.2 E currentStock < reorderPoint
    df['regra_sazonal'] = (
        (df['seasonalIndex'] > 1.2)
        & (df['currentStock'] < df['reorderPoint'])
    )

    # 3. Regra Zumbi: True se currentStock > 0 E lastSaleDate for há mais de 60 dias
    df['regra_zumbi'] = (
        (df['currentStock'] > 0)
        & (df['lastSaleDate'] <= (current_date - timedelta(days=60)))
    )

    # 4. Score Risco: Inteiro de 0 a 100
    def calcula_score(row):
        # Se for Bomba ou Sazonal (Risco de faltar produto - Prioridade Máxima)
        if row['regra_bomba']:
            score = 70
            if row['regra_sazonal']: 
                score += 15
            if row['marginPct'] > 40: 
                score += 15
            return min(100, score)
            
        # Se for apenas Sazonal
        elif row['regra_sazonal']:
            score = 45  # Piso elevado para destacar sazonalidade
            if row['marginPct'] > 40: 
                score += 15
            return min(100, score)

        # Se for apenas Zumbi (Risco de dinheiro preso - Prioridade Média)
        elif row['regra_zumbi']:
            score = 40  # Score intermediário para aparecer no radar
            if row['marginPct'] > 40: 
                score += 15  # Se a margem for alta, o impacto financeiro é maior
            return min(100, score)
            
        # Casos Saudáveis / Sem alertas críticos
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

    # Exibir resumo das novas colunas
    print("\n" + "="*150)
    print("RESUMO DAS NOVAS COLUNAS CRIADAS")
    print("="*150)
    print(f"\nTotal de SKUs: {len(df)}")
    print(f"Regra Bomba (True): {df['regra_bomba'].sum()} produtos")
    print(f"Regra Sazonal (True): {df['regra_sazonal'].sum()} produtos")
    print(f"Regra Zumbi (True): {df['regra_zumbi'].sum()} produtos")
    print(f"\nScore Risco - Estatísticas:")
    print(f"  Mínimo: {df['score_risco'].min()}")
    print(f"  Máximo: {df['score_risco'].max()}")
    print(f"  Média: {df['score_risco'].mean():.2f}")
    print(f"  Mediana: {df['score_risco'].median():.2f}")
    print(f"  Desvio Padrão: {df['score_risco'].std():.2f}")
    print("\n" + "="*150 + "\n")

    # Exibir DataFrame completo com as 4 novas colunas
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', None)

    novas_colunas = ['regra_bomba', 'regra_sazonal', 'regra_zumbi', 'score_risco']
    print(df[[*df.columns.difference(novas_colunas), *novas_colunas]].to_string(index=False))

    # Salvar resultado em HTML
    html = gerar_html_interativo(df)
    output_path = Path('resultado_inventario.html')
    output_path.write_text(html, encoding='utf-8')
    print(f'\n\nArquivo gerado com sucesso: {output_path.resolve()}')

    # Salvar resultado em CSV
    csv_output_path = Path('skus_processado.csv')
    df.to_csv(csv_output_path, index=False)
    print(f'Arquivo CSV gerado com sucesso: {csv_output_path.resolve()}\n')


if __name__ == '__main__':
    main()

