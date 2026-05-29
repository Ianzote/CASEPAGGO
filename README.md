# SOL — Smart Optimized Logistics 🚀
> Case Técnico: Paggo Inventory App & AI Consultant

O **SOL** é um ecossistema completo de inteligência logística idealizado e estruturado para transformar dados brutos de inventário em decisões estratégicas de alta velocidade. A solução resolve o problema de monitoramento de mais de 8.000 SKUs combinando **Engenharia de Dados em Python**, um banco de dados relacional em nuvem (**Supabase**), uma interface web de alta performance (**Next.js + TypeScript**) e um consultor de IA especialista integrado via **RAG (Retrieval-Augmented Generation)**.

---

## 🧠 Concepção do Projeto & Uso Estratégico de IA

Toda a modelagem do problema, a criação das regras de negócio (Bomba e Zumbi), a estrutura matemática do Score de Risco e a arquitetura do sistema **foram idealizadas e criadas por mim**. 

A inteligência artificial foi utilizada de forma complementar e extremamente estratégica durante o ciclo de desenvolvimento: atuou como um **co-piloto de engenharia** para acelerar a escrita de componentes puramente visuais, refinar a tipagem em TypeScript e, principalmente, ajudar a debugar e construir a lógica de *fallback* (blindagem de rotas) quando enfrentamos gargalos de limites de requisições nas APIs externas. O resultado é um produto guiado por visão humana com refino técnico assistido.

---

## 🛠️ Arquitetura do Projeto & Decisões de Design

O projeto foi arquitetado seguindo o princípio de separação estrita de responsabilidades (Separation of Concerns), dividido em três camadas principais:

1. **Camada de Inteligência e Processamento (Pipeline Python):** Onde os dados brutos de `skus.csv` são limpos, sanitizados e enriquecidos matematicamente através de regras de negócio antes de serem persistidos.
2. **Camada de Persistência (Supabase):** Banco de dados relacional na nuvem responsável por armazenar os dados processados e expor índices otimizados para paginação rápida no frontend e consultas de contexto para a IA.
3. **Camada de Aplicação e UX (Next.js 14 + TailwindCSS):** Interface fluida, focada em produtividade (ocupando 100% da viewport), com paginação dinâmica do lado do servidor e um chat flutuante persistente para o analista interagir com o **SOL** sem perder a visibilidade dos dados.

---

## 📊 Regras de Priorização e Gestão de Risco

Para mitigar erros de interpretação e priorizar o que realmente drena o caixa da empresa, desenvolvemos regras de negócio logísticas estritas baseadas em duas flags principais e um score matemático unificado:

### 1. Regra Bomba (Ruptura Crítica de Estoque)
Sinaliza itens com **alto volume de vendas diárias ativas, mas cujo estoque atual zerou ou está abaixo do ponto de ressuprimento crítico**. 
* *Por que escolher?* Evita a perda imediata de faturamento (churn de receita) por falta de produto disponível para venda.

### 2. Regra Zumbi (Capital Parado / Encalhe)
Sinaliza itens com **alto volume de estoque acumulado, mas com taxa de saída nula ou estagnada há mais de 90 dias**.
* *Por que escolher?* Identifica gargalos onde o capital de giro da empresa está congelado no galpão, gerando custo de oportunidade e depreciação física.

### 3. Score de Risco Unificado
Cada SKU recebe um score dinâmico que cruza o volume financeiro movimentado, o tempo de giro e o desvio padrão do ponto de reordenamento. A tabela do painel renderiza e ordena automaticamente os itens a partir desse score, garantindo que o analista foque no topo da pirâmide de prejuízo em potencial.

---

## 🤖 Integração com Inteligência Artificial & Resiliência (RAG)

O chat do **SOL** não é apenas uma API genérica. Ele foi construído utilizando **RAG (Retrieval-Augmented Generation)**:
* Toda vez que o analista envia uma mensagem, o backend intercepta a requisição, busca os **10 SKUs de maior risco real** no Supabase e injeta esses dados estruturados dinamicamente no `systemInstruction` da IA.

### 🛡️ Engenharia de Resiliência (Blindagem de Cota)
Decisão de design crucial para sistemas em produção: sabendo que APIs externas (como Google Gemini) podem sofrer com limites de cota da camada gratuita (*Rate Limits - Erros 429/404*), o backend foi blindado com uma **lógica de contingência local**. Se o Google recusar a requisição por estouro de cota, um interceptor ativa o modo de contingência, consome os dados estruturados do banco e gera respostas lógicas em tempo real na tela, impedindo que o sistema quebre ou fique sem resposta.

---

## 🚀 Como Executar o Projeto (Setup)

### Pré-requisitos
* Node.js (v18+)
* Python (v3.10+)
* Contas configuradas no Supabase e chave de API do Gemini.

### 1. Preparação dos Dados (Python)
Navegue até a pasta raiz onde estão os scripts Python:
```bash
# Instale as dependências necessárias
pip install pandas supabase dotenv

# Execute a lógica de processamento matemático de dados
python logica.py

# Execute o upload em massa para o banco de dados na nuvem
python upload_supabase.py
