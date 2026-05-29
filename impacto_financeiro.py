import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

def calcular_impacto_financeiro():
    """
    Calcula quanto de dinheiro a pessoa deixaria de ganhar 
    se não tomar cuidado com os dados de inventário
    """
    
    df = pd.read_csv('skus.csv')
    
    current_date = datetime(2026, 3, 31)
    df['lastSaleDate'] = pd.to_datetime(df['lastSaleDate'], errors='coerce')
    
    # ==================== REGRAS DE RISCO ====================
    
    # Regra Bomba: Risco de faltar estoque
    df['regra_bomba'] = (
        (df['dailySales30dAvg'] > 0)
        & (df['currentStock'] / df['dailySales30dAvg'] < df['leadTimeDays'])
    )
    
    # Regra Sazonal
    df['regra_sazonal'] = (
        (df['seasonalIndex'] > 1.2)
        & (df['currentStock'] < df['reorderPoint'])
    )
    
    # Regra Zumbi: Estoque parado por 60+ dias
    df['regra_zumbi'] = (
        (df['currentStock'] > 0)
        & (df['lastSaleDate'] <= (current_date - timedelta(days=60)))
    )
    
    # ==================== CÁLCULO DE MARGIN (LUCRO POR UNIDADE) ====================
    df['margem_unitaria'] = df['unitPrice'] - df['unitCost']
    
    # ==================== CENÁRIO 1: PERDA POR FALTA DE ESTOQUE ====================
    
    # Produtos em risco (Bomba + Sazonal)
    df['em_risco_falta'] = df['regra_bomba'] | df['regra_sazonal']
    
    # Quantidade de dias até faltar estoque (considerando lead time)
    df['dias_ate_faltar'] = df.apply(
        lambda row: (row['currentStock'] / row['dailySales30dAvg']) 
        if (row['dailySales30dAvg'] > 0 and row['regra_bomba']) 
        else float('nan'),
        axis=1
    )
    
    # Número de vendas perdidas durante o lead time
    # Se falta estoque por X dias, perde X dias de vendas
    def calcular_vendas_perdidas(row):
        if not row['em_risco_falta'] or pd.isna(row['dailySales30dAvg']):
            return 0
        
        # Se está na bomba, o estoque faltar antes do novo chegar
        if row['regra_bomba']:
            dias_sem_estoque = row['leadTimeDays']
            vendas_perdidas = row['dailySales30dAvg'] * dias_sem_estoque
            return vendas_perdidas
        
        return 0
    
    df['vendas_perdidas_unidades'] = df.apply(calcular_vendas_perdidas, axis=1)
    df['vendas_perdidas_lucro'] = df['vendas_perdidas_unidades'] * df['margem_unitaria']
    
    # ==================== CENÁRIO 2: DINHEIRO PRESO EM PRODUTOS ZUMBIS ====================
    
    df['dinheiro_preso'] = df.apply(
        lambda row: row['currentStock'] * row['unitCost'] 
        if row['regra_zumbi'] 
        else 0,
        axis=1
    )
    
    # Custo de oportunidade anual (10% de juros/custo de capital típico)
    taxa_anual = 0.10
    dias_parado = 60  # Mínimo 60 dias parado
    
    df['custo_oportunidade'] = df['dinheiro_preso'] * (taxa_anual * (dias_parado / 365))
    
    # Assumindo venda média antes de parar (para estimar lucro perdido)
    df['lucro_perdido_zumbi'] = df.apply(
        lambda row: row['currentStock'] * row['margem_unitaria'] 
        if row['regra_zumbi'] 
        else 0,
        axis=1
    )
    
    # ==================== IMPACTO TOTAL ====================
    
    df['impacto_total'] = df['vendas_perdidas_lucro'] + df['lucro_perdido_zumbi']
    
    # ==================== RELATÓRIO ====================
    
    print("\n" + "="*160)
    print("💰 ANÁLISE DE IMPACTO FINANCEIRO - QUANTO VOCÊ DEIXARIA DE GANHAR")
    print("="*160)
    
    # Cenário 1: Falta de Estoque
    total_vendas_perdidas_lucro = df['vendas_perdidas_lucro'].sum()
    produtos_em_risco = df['em_risco_falta'].sum()
    
    print(f"\n📉 CENÁRIO 1: PERDA POR FALTA DE ESTOQUE")
    print(f"   Produtos em risco (Bomba + Sazonal): {produtos_em_risco}")
    print(f"   Unidades que deixariam de ser vendidas: {df['vendas_perdidas_unidades'].sum():.0f}")
    print(f"   💸 LUCRO DEIXADO DE GANHAR: R$ {total_vendas_perdidas_lucro:,.2f}")
    
    # Top 10 produtos com maior perda de vendas
    top_vendas_perdidas = df[df['vendas_perdidas_lucro'] > 0].nlargest(10, 'vendas_perdidas_lucro')
    if len(top_vendas_perdidas) > 0:
        print(f"\n   Top 10 Produtos com Maior Risco de Perda de Vendas:")
        for idx, (_, row) in enumerate(top_vendas_perdidas.iterrows(), 1):
            print(f"   {idx}. {row['skuName']} (SKU: {row['skuId']}) - R$ {row['vendas_perdidas_lucro']:,.2f}")
    
    # Cenário 2: Dinheiro Preso
    total_dinheiro_preso = df['dinheiro_preso'].sum()
    total_lucro_perdido_zumbi = df['lucro_perdido_zumbi'].sum()
    produtos_zumbis = df['regra_zumbi'].sum()
    
    print(f"\n\n🧟 CENÁRIO 2: DINHEIRO PRESO EM PRODUTOS ZUMBIS (SEM VENDA HÁ 60+ DIAS)")
    print(f"   Produtos parados/zumbis: {produtos_zumbis}")
    print(f"   Unidades paradas: {df[df['regra_zumbi']]['currentStock'].sum():.0f}")
    print(f"   Dinheiro investido parado: R$ {total_dinheiro_preso:,.2f}")
    print(f"   Custo de oportunidade (juros 10% a.a.): R$ {df['custo_oportunidade'].sum():,.2f}")
    print(f"   💸 LUCRO QUE NÃO ENTRA (produtos zumbis): R$ {total_lucro_perdido_zumbi:,.2f}")
    
    # Top 10 produtos com maior dinheiro preso
    top_dinheiro_preso = df[df['dinheiro_preso'] > 0].nlargest(10, 'dinheiro_preso')
    if len(top_dinheiro_preso) > 0:
        print(f"\n   Top 10 Produtos com Maior Dinheiro Preso:")
        for idx, (_, row) in enumerate(top_dinheiro_preso.iterrows(), 1):
            print(f"   {idx}. {row['skuName']} (SKU: {row['skuId']}) - R$ {row['dinheiro_preso']:,.2f} investido")
    
    # RESUMO EXECUTIVO
    print(f"\n\n" + "="*160)
    print("📊 RESUMO EXECUTIVO - IMPACTO FINANCEIRO TOTAL")
    print("="*160)
    
    impacto_falta_estoque = total_vendas_perdidas_lucro
    impacto_zumbi = total_lucro_perdido_zumbi
    impacto_total = impacto_falta_estoque + impacto_zumbi
    
    print(f"\n1️⃣  Lucro perdido por faltas de estoque: R$ {impacto_falta_estoque:,.2f}")
    print(f"2️⃣  Lucro não realizado por produtos zumbis: R$ {impacto_zumbi:,.2f}")
    print(f"\n💥 IMPACTO FINANCEIRO TOTAL: R$ {impacto_total:,.2f}")
    
    print(f"\n💡 INTERPRETAÇÃO:")
    print(f"   Se você não tomar cuidado com os dados e deixar produtos:")
    print(f"   • Faltarem em estoque → perderá R$ {impacto_falta_estoque:,.2f} em vendas")
    print(f"   • Parados sem vender → terá R$ {impacto_zumbi:,.2f} travado")
    print(f"   • Total: deixará de ganhar/economizar R$ {impacto_total:,.2f}")
    
    # Conversão em tempo
    ticket_medio = df[(df['unitPrice'] * df['dailySales30dAvg']) > 0]['marginPct'].mean() / 100
    if ticket_medio > 0:
        dias_equivalentes = impacto_total / (df['margem_unitaria'].mean() * df['dailySales30dAvg'].mean())
        print(f"\n⏰ Equivalente a {dias_equivalentes:.0f} dias de vendas normais!")
    
    print("\n" + "="*160 + "\n")
    
    # ==================== EXPORTAR RESULTADOS ====================
    
    # Selecionar colunas relevantes para exportar
    colunas_export = [
        'skuId', 'skuName', 'category', 'unitPrice', 'unitCost', 'marginPct',
        'currentStock', 'dailySales30dAvg', 'seasonalIndex',
        'regra_bomba', 'regra_sazonal', 'regra_zumbi',
        'vendas_perdidas_unidades', 'vendas_perdidas_lucro',
        'dinheiro_preso', 'lucro_perdido_zumbi', 'impacto_total'
    ]
    
    df_export = df[colunas_export].copy()
    df_export = df_export.sort_values('impacto_total', ascending=False)
    
    csv_path = Path('impacto_financeiro.csv')
    df_export.to_csv(csv_path, index=False)
    print(f"✅ Arquivo exportado: {csv_path.resolve()}")
    
    # ==================== GERAR HTML COM VISUALIZAÇÃO ====================
    
    gerar_html_impacto(df, impacto_total, impacto_falta_estoque, impacto_zumbi)
    
    return df

def gerar_html_impacto(df, impacto_total, impacto_falta, impacto_zumbi):
    """Gera HTML visual com o impacto financeiro"""
    
    # Produtos com maior impacto
    top_impacto = df[df['impacto_total'] > 0].nlargest(15, 'impacto_total')
    
    # Estatísticas
    produtos_em_risco = (df['regra_bomba'] | df['regra_sazonal']).sum()
    produtos_zumbis = df['regra_zumbi'].sum()
    
    tabela_html = top_impacto[[
        'skuId', 'skuName', 'impacto_total', 'vendas_perdidas_lucro', 'lucro_perdido_zumbi'
    ]].to_html(index=False, classes="dataTable", table_id="impactoTable", escape=False)
    
    # Cores para o gráfico
    cores = ['#e53e3e', '#ed8936', '#38a169']
    
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Impacto Financeiro - Análise de Risco</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css" />
    <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        .header {{
            background: linear-gradient(135deg, #f56565 0%, #ed8936 100%);
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
        
        .big-number {{
            font-size: 3.5em;
            font-weight: bold;
            margin-top: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }}
        
        .dashboard {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        
        .card {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        
        .card.danger {{
            background: linear-gradient(135deg, #f56565 0%, #ed8936 100%);
            color: white;
            border-left: 5px solid #c53030;
        }}
        
        .card.warning {{
            background: linear-gradient(135deg, #ed8936 0%, #f6ad55 100%);
            color: white;
            border-left: 5px solid #c05621;
        }}
        
        .card.info {{
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            border-left: 5px solid #2c5aa0;
        }}
        
        .card-label {{
            font-size: 0.9em;
            opacity: 0.9;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .card-value {{
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }}
        
        .card-subtitle {{
            font-size: 0.85em;
            opacity: 0.85;
        }}
        
        .chart-container {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
            position: relative;
            height: 400px;
        }}
        
        .chart-title {{
            font-size: 1.3em;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
        }}
        
        .table-container {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow-x: auto;
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
        
        .valor-grande {{
            color: #e53e3e;
            font-weight: bold;
            font-size: 1.1em;
        }}
        
        .insights {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-top: 30px;
            border-left: 5px solid #4299e1;
        }}
        
        .insights h3 {{
            color: #2d3748;
            margin-bottom: 15px;
            font-size: 1.3em;
        }}
        
        .insights ul {{
            list-style: none;
            padding: 0;
        }}
        
        .insights li {{
            margin: 10px 0;
            padding-left: 25px;
            position: relative;
            color: #4a5568;
        }}
        
        .insights li:before {{
            content: "→";
            position: absolute;
            left: 0;
            font-weight: bold;
            color: #4299e1;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 IMPACTO FINANCEIRO</h1>
            <p>Quanto você deixaria de ganhar se não tomar cuidado com seus dados</p>
            <div class="big-number">R$ {impacto_total:,.2f}</div>
        </div>
        
        <div class="dashboard">
            <div class="card danger">
                <div class="card-label">⚠️ Perda por Falta de Estoque</div>
                <div class="card-value">R$ {impacto_falta:,.2f}</div>
                <div class="card-subtitle">Vendas que você não conseguiria fazer</div>
            </div>
            
            <div class="card warning">
                <div class="card-label">🧟 Lucro Travado em Zumbis</div>
                <div class="card-value">R$ {impacto_zumbi:,.2f}</div>
                <div class="card-subtitle">Produtos parados sem vender há 60+ dias</div>
            </div>
            
            <div class="card info">
                <div class="card-label">📊 Produtos em Risco</div>
                <div class="card-value">{(df['regra_bomba'] | df['regra_sazonal']).sum()}</div>
                <div class="card-subtitle">Podem faltar estoque em breve</div>
            </div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">📈 Composição do Impacto Financeiro</div>
            <canvas id="impactoChart"></canvas>
        </div>
        
        <div class="table-container">
            <h3 style="margin-bottom: 20px; color: #2d3748;">Top 15 Produtos com Maior Impacto Financeiro</h3>
            {tabela_html}
        </div>
        
        <div class="insights">
            <h3>💡 Recomendações</h3>
            <ul>
                <li><strong>Revise produtos em risco:</strong> {(df['regra_bomba'] | df['regra_sazonal']).sum()} produtos podem faltar em breve</li>
                <li><strong>Limpe produtos zumbis:</strong> {df['regra_zumbi'].sum()} produtos parados representam R$ {df[df['regra_zumbi']]['dinheiro_preso'].sum():,.2f} investidos sem retorno</li>
                <li><strong>Acompanhe estoque:</strong> Use os dados para fazer reposições preventivas</li>
                <li><strong>Analise sazonalidade:</strong> Prepare-se para picos de demanda sazonal</li>
            </ul>
        </div>
    </div>
    
    <script>
        const ctx = document.getElementById('impactoChart').getContext('2d');
        new Chart(ctx, {{
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
                            font: {{ size: 14 }},
                            usePointStyle: true
                        }}
                    }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                return 'R$ ' + context.parsed.toLocaleString('pt-BR', {{maximumFractionDigits: 2}});
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // DataTable
        $(function () {{
            $('#impactoTable').DataTable({{
                paging: true,
                pageLength: 15,
                ordering: true,
                searching: true,
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
                    targets: [2, 3, 4],
                    render: function(data) {{
                        return 'R$ ' + parseFloat(data).toLocaleString('pt-BR', {{maximumFractionDigits: 2}});
                    }}
                }}]
            }});
        }});
    </script>
</body>
</html>
"""
    
    output_path = Path('impacto_financeiro.html')
    output_path.write_text(html, encoding='utf-8')
    print(f"✅ HTML gerado: {output_path.resolve()}")


if __name__ == '__main__':
    calcular_impacto_financeiro()
