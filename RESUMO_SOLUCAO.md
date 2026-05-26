# 📊 Script de Processamento de Inventário - logica.py

## ✅ Solução Implementada

O script `logica.py` foi criado com sucesso utilizando **pandas** para processar o arquivo `skus.csv` e gerar **4 novas colunas** com as regras de análise de inventário.

---

## 📋 As 4 Novas Colunas Criadas

### 1. **regra_bomba** (Booleano)

- **Condição**: `(currentStock / dailySales30dAvg) < leadTimeDays`
- **Interpretação**: Identifica produtos em risco de faltar estoque baseado no consumo diário médio
- **Resultado**: 835 produtos afetados (10,4% do catálogo)

### 2. **regra_sazonal** (Booleano)

- **Condição**: `seasonalIndex > 1.2 E currentStock < reorderPoint`
- **Interpretação**: Detecta produtos sazonais com estoque abaixo do ponto de reposição
- **Resultado**: 314 produtos afetados (3,9% do catálogo)

### 3. **regra_zumbi** (Booleano)

- **Condição**: `currentStock > 0 E lastSaleDate > 60 dias atrás (referência: 31/03/2026)`
- **Interpretação**: Encontra produtos com estoque parado (nenhuma venda há 60+ dias)
- **Resultado**: 574 produtos afetados (7,2% do catálogo)

### 4. **score_risco** (Inteiro 0-100)

Lógica de pontuação progressiva:

- **Se regra_bomba = True**: base 70 pontos
  - Se também regra_sazonal = True: +15 pontos
  - Se marginPct > 40%: +15 pontos
  - Score máximo com essas combinações: 100
- **Se apenas regra_sazonal = True**: 15 pontos (+ 15 se marginPct > 40%)
- **Se nenhuma regra**: 0-30 baseado na proximidade do estoque ao zero (reorderPoint)

**Estatísticas Score Risco:**

- Mínimo: 0
- Máximo: 100
- Média: 8.69
- Mediana: 0.0
- Desvio Padrão: 25.68

---

## 🎯 Dados Processados

**Total de SKUs**: 8.000 produtos

**Distribuição de Riscos:**
| Métrica | Qtd | % |
|---------|-----|---|
| Regra Bomba | 835 | 10.4% |
| Regra Sazonal | 314 | 3.9% |
| Regra Zumbi | 574 | 7.2% |

---

## 📁 Arquivos Gerados

1. **logica.py** - Script principal com toda a lógica
2. **skus_processado.csv** - Dataset completo com as 4 novas colunas
3. **resultado_inventario.html** - Tabela interativa (DataTables) para análise visual

---

## 🚀 Como Executar

```bash
python logica.py
```

O script irá:

1. Ler `skus.csv`
2. Calcular as 4 novas colunas
3. Exibir resumo estatístico no console
4. Gerar `skus_processado.csv` com todos os dados
5. Gerar `resultado_inventario.html` para visualização interativa

---

## 💡 Exemplos de Uso

### Identificar produtos de alto risco:

```python
import pandas as pd
df = pd.read_csv('skus_processado.csv')
alto_risco = df[df['score_risco'] > 70]
print(f"Produtos de alto risco: {len(alto_risco)}")
```

### Encontrar produtos zumbis (parados):

```python
zombies = df[df['regra_zumbi'] == True]
print(f"Produtos sem vendas há 60+ dias: {len(zombies)}")
```

### Produtos sazonais em risco:

```python
sazonal_risco = df[(df['regra_sazonal'] == True) & (df['score_risco'] > 30)]
print(f"Produtos sazonais em risco: {len(sazonal_risco)}")
```

---

## 📊 Estrutura do Código

```python
# 1. Leitura e preparação de dados
df = pd.read_csv('skus.csv')
df['lastSaleDate'] = pd.to_datetime(df['lastSaleDate'], errors='coerce')

# 2. Cálculo das 4 regras booleanas
df['regra_bomba'] = (df['dailySales30dAvg'] > 0) & (...)
df['regra_sazonal'] = (df['seasonalIndex'] > 1.2) & (...)
df['regra_zumbi'] = (df['currentStock'] > 0) & (...)

# 3. Cálculo do score com lógica progressive
def calcula_score(row):
    # Lógica implementada conforme especificação
    ...

df['score_risco'] = df.apply(calcula_score, axis=1)

# 4. Exportação de resultados
df.to_csv('skus_processado.csv')
```

---

## ✨ Recursos Extras

- ✅ Tratamento de divisão por zero na regra_bomba
- ✅ Conversão automática de datas
- ✅ Cálculos robustos com margem de erro tratada
- ✅ Tabela HTML interativa com DataTables
- ✅ Resumo estatístico no console
- ✅ Exportação em CSV para análise futura

---

## 📝 Notas Importantes

1. A data de referência utilizada é **31 de março de 2026** (conforme especificado)
2. Divisão por zero é tratada automaticamente (dailySales30dAvg = 0)
3. O score_risco garante que todos os valores estejam entre 0 e 100
4. As regras são independentes - um produto pode ativar múltiplas regras

---

**Status**: ✅ Implementação Completa e Testada
