import pandas as pd
from datetime import datetime, timedelta

df = pd.read_csv('skus.csv')
data_referencia = datetime(2026, 3, 31)
df['lastSaleDate'] = pd.to_datetime(df['lastSaleDate'], errors='coerce')

# 1. Regra Bomba
df['regra_bomba'] = ((df['dailySales30dAvg'] > 0) & (df['currentStock'] / df['dailySales30dAvg'] < df['leadTimeDays']))

# 2. Regra Sazonal
df['regra_sazonal'] = ((df['seasonalIndex'] > 1.2) & (df['currentStock'] < df['reorderPoint']))

# 3. Regra Zumbi
df['regra_zumbi'] = ((df['currentStock'] > 0) & (df['lastSaleDate'] <= (data_referencia - timedelta(days=60))))

# 4. Score Risco
def calcular_score_risco(row):
    score = 0
    if row['regra_bomba']:
        score = 70
        if row['regra_sazonal']:
            score += 15
        if row['marginPct'] > 40:
            score += 15
    elif row['regra_sazonal']:
        score = 15
        if row['marginPct'] > 40:
            score += 15
    else:
        if row['reorderPoint'] > 0:
            razao_estoque = row['currentStock'] / row['reorderPoint']
            if razao_estoque < 1:
                score = int(30 * (1 - razao_estoque))
            else:
                score = max(0, int(5 * (1 - min(razao_estoque - 1, 1))))
        else:
            if row['currentStock'] <= 5:
                score = 20
            elif row['currentStock'] <= 10:
                score = 10

df['score_risco'] = df.apply(calcular_score_risco, axis=1)

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
print("\n" + "="*150)
print("\nExemplos de SKUs com regra_bomba=True (Top 5):")
print("="*150)
cols = ['skuId', 'skuName', 'currentStock', 'dailySales30dAvg', 'leadTimeDays', 'regra_bomba', 'regra_sazonal', 'score_risco']
print(df[df['regra_bomba']][cols].head(5).to_string(index=False))
print("\n" + "="*150)
print("Exemplos de SKUs com regra_sazonal=True (Top 5):")
print("="*150)
print(df[df['regra_sazonal']][cols].head(5).to_string(index=False))
print("\n" + "="*150)
print("Exemplos de SKUs com regra_zumbi=True (Top 5):")
print("="*150)
print(df[df['regra_zumbi']][cols].head(5).to_string(index=False))
print("\n" + "="*150)
print("Distribuição de Score Risco:")
print("="*150)
print(df['score_risco'].value_counts().sort_index().to_string())
print("\n✓ Script executado com sucesso!\n")
