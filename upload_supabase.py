import pandas as pd
from supabase import create_client, Client
import math

# 1. Configurações de Conexão com o Supabase
SUPABASE_URL = "https://wsujuwvvwxfolrkcjzby.supabase.co"
SUPABASE_KEY = "sb_secret_JePYUTjebjCeIwzlhIHAsw_O8V5tEM9"

print("🔌 Conectando ao Supabase...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Leitura do arquivo processado
print("📖 Lendo o arquivo skus_processado.csv...")
df = pd.read_csv('skus_processado.csv')

# Substituir valores NaN (nulos) por None para o banco de dados aceitar corretamente
df = df.where(pd.notnull(df), None)

# Converter colunas de data para string no formato correto ou None
for col in ['lastSaleDate', 'lastReorderDate']:
    if col in df.columns:
        df[col] = df[col].apply(lambda x: str(x)[:10] if x is not None else None)

# 3. Preparar os dados para o formato que o Supabase espera (Lista de Dicionários)
print("📦 Estruturando os dados para o banco...")
registros = []
for _, row in df.iterrows():
    registro = {
        "sku_id": str(row['skuId']),
        "sku_name": str(row['skuName']),
        "category": str(row['category']),
        "supplier": str(row['supplier']),
        "unit_cost": float(row['unitCost']),
        "unit_price": float(row['unitPrice']),
        "current_stock": int(row['currentStock']),
        "reorder_point": int(row['reorderPoint']) if row['reorderPoint'] is not None else 0,
        "reorder_qty": int(row['reorderQty']) if row['reorderQty'] is not None else 0,
        "lead_time_days": int(row['leadTimeDays']),
        "daily_sales_30d_avg": float(row['dailySales30dAvg']),
        "daily_sales_90d_avg": float(row['dailySales90dAvg']),
        "last_sale_date": row['lastSaleDate'],
        "last_reorder_date": row['lastReorderDate'],
        "stockout_days_last_90d": int(row['stockoutDaysLast90d']) if row['stockoutDaysLast90d'] is not None else 0,
        "seasonal_index": float(row['seasonalIndex']),
        "margin_pct": float(row['marginPct']),
        "regra_bomba": bool(row['regra_bomba']),
        "regra_sazonal": bool(row['regra_sazonal']),
        "regra_zumbi": bool(row['regra_zumbi']),
        "score_risco": int(row['score_risco'])
    }
    registros = [] + registros + [registro]

# 4. Enviar os dados em lotes (para evitar sobrecarregar a API com 8.000 linhas de uma vez)
tamanho_lote = 500
total_registros = len(registros)

print(f"🚀 Iniciando o upload de {total_registros} SKUs...")

for i in range(0, total_registros, tamanho_lote):
    lote = registros[i:i + tamanho_lote]
    try:
        # Envia o lote para a tabela 'skus'
        supabase.table("skus").insert(lote).execute()
        print(f"✅ Lote {int(i/tamanho_lote) + 1} enviado: Itens {i} até {min(i + tamanho_lote, total_registros)}")
    except Exception as e:
        print(f"❌ Erro ao enviar o lote {int(i/tamanho_lote) + 1}: {e}")
        break

print("\n🎉 Processo de carga finalizado com sucesso!")