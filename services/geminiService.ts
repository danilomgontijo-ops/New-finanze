import { Demand } from "../types";
import { generateFiscalizacaoLink, generateTceLink } from "../utils/linkGenerators";
import { auth } from "./firebase";
import { parseBRNumber } from "../utils/formatters";

const GEMINI_MODEL = 'gemini-3.8-flash';

// Call our backend instead of the GenAI SDK directly.
// The server already falls back across models on 503/overload/rate-limit, so the client retries only
// once on "server busy" and never on rate limit (otherwise each question could trigger ~12 model calls).
const callGeminiWithRetry = async (params: any, retries = 2, delayMs = 3000) => {
    let lastError: any = null;

    for (let i = 0; i < retries; i++) {
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                throw new Error("Usuário não autenticado. Faça login novamente para usar a IA.");
            }

            const res = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
                body: JSON.stringify(params)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errMessage = errorData.error || `Erro na comunicação com a IA (HTTP ${res.status})`;
                
                const isSpendingCap = errorData.isSpendingCap ||
                                      errMessage.toLowerCase().includes("spending cap") || 
                                      errMessage.toLowerCase().includes("ai.studio/spend") || 
                                      errMessage.toLowerCase().includes("spend cap");

                if (isSpendingCap) {
                    const spendingCapErr: any = new Error(errMessage);
                    spendingCapErr.isSpendingCap = true;
                    throw spendingCapErr;
                }

                const customErr: any = new Error(errMessage);
                customErr.status = res.status;
                customErr.isRateLimit = errorData.isRateLimit;
                throw customErr;
            }

            const data = await res.json();
            return { text: data.text };
        } catch (error: any) {
            lastError = error;

            // Spending cap is persistent: never retry
            if (error?.isSpendingCap) {
                throw error;
            }

            // Rate limit: the server already tried the fallback models, so retrying seconds later won't help
            if (error?.isRateLimit) {
                throw new Error("Limite de requisições por minuto atingido temporariamente. Aguarde alguns instantes antes de reenviar.");
            }

            const errStr = String(error?.message || '');
            const isTransient = error?.status === 503 ||
                                errStr.includes('503') ||
                                errStr.includes('UNAVAILABLE') ||
                                errStr.includes('high demand');

            if (!isTransient) {
                throw error;
            }
            if (i < retries - 1) {
                console.warn(`Gemini API temporariamente ocupada (tentativa ${i + 1}/${retries}). Aguardando ${delayMs}ms para tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                throw new Error("O modelo Gemini está temporariamente sob alta demanda (Servidor Ocupado 503). Por favor, aguarde alguns instantes e tente novamente.");
            }
        }
    }
    throw lastError || new Error("O modelo Gemini está temporariamente indisponível. Tente novamente em alguns momentos.");
};

/** Sends a single text prompt to the configured model and returns the generated text. */
const generateText = async (prompt: string): Promise<string> => {
    const response = await callGeminiWithRetry({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            maxOutputTokens: 8192,
        }
    });
    return response.text;
};

export const summarizeReport = async (reportText: string): Promise<string> => {
    const prompt = `Você é um Auditor Especialista do Tribunal de Contas.
Analise o relatório de fiscalização/auditoria a seguir. Os relatórios de fiscalização possuem estrutura em tópicos/achados, contendo a condição/situação encontrada (com alíneas e itens se houver), a manifestação/resposta do gestor, a análise da equipe de fiscalização e a conclusão quanto ao saneamento do achado.

Para CADA ACHADO identificado no relatório, estruture o resumo rigorosamente em Português do Brasil no formato NARRATIVO a seguir, respeitando os espaçamentos e linhas em branco:

ACHADO X: [Título claro e objetivo do Achado]

[Parágrafo único em texto corrido e narrativo: inicia sintetizando o que o achado X identificou; detalha o que a condição apontava (mantendo expressamente as referências aos itens e alíneas a, b, c..., caso existam no relatório); descreve o que o gestor respondeu e apresentou em sua manifestação para cada ponto; e apresenta a análise da equipe de fiscalização avaliando os argumentos e documentos, explicando detalhadamente o que foi considerado sanado/suficiente e quais irregularidades persistiram não sanadas e por quê, ressaltando itens de materialidade e princípios infringidos.]

- CONCLUSÃO: [Achado Sanado OU Achado Não Sanado OU Achado Parcialmente Sanado]

============================================================
EXEMPLO EXATO DO PADRÃO OBRIGATÓRIO QUE VOCÊ DEVE SEGUIR:
============================================================
ACHADO 1: Inadequação nos custos que compõem a modelagem econômico-financeira do projeto.

O achado 1 identificou inadequações nos custos da modelagem econômico-financeira do projeto. A condição apontava para a desatualização de valores no Estudo de Viabilidade Técnico Econômico (EVTE) (a), a falta de embasamento dos custos unitários nos gastos operacionais (OPEX) (b), a carência de embasamento nos custos unitários dos gastos de capital (CAPEX) (c), e a ausência de clareza na definição do compartilhamento de receitas provenientes da alienação de bens (d). Em resposta, o gestor atualizou os valores de referência do EVTE para abril de 2025 (a), incluiu referências e fontes para os itens do OPEX e realizou um estudo de mercado para a destinação final privada (b), e esclareceu que as receitas da alienação de veículos foram incorporadas ao fluxo de caixa do projeto (d). A análise da equipe de fiscalização considerou que as alterações e justificativas para os itens (a), (b) e (d) foram suficientes para sanar as questões. No entanto, a irregularidade referente à falta de embasamento adequado para os custos unitários do CAPEX (c) persistiu, pois a mera menção a "fornecedor" sem especificação das fontes ou documentação comprobatória foi considerada insuficiente para justificar itens de alta materialidade, como o Trator de esteira, Pá carregadeira, Varredeira, Trator roçadeira, Giro Zero, Sistema de gestão da concessão, PEV, e especialmente os Equipamentos da Tecnologia 100t/dia, Equipamentos elétricos e Galpão da Unidade de Tratamento de Resíduos Sólidos Urbanos, além da ausência de justificativa para um adicional de 20% sobre o CAPEX original da tecnologia, comprometendo os princípios licitatórios.

- CONCLUSÃO: Achado Não Sanado
============================================================

REGRAS RÍGIDAS DE FORMATAÇÃO (OBRIGATÓRIO):
1. NUNCA utilize marcadores separados como "- CONDIÇÃO (SITUAÇÃO ENCONTRADA):" ou "- ANÁLISE DA EQUIPE DE FISCALIZAÇÃO:". É ESTRITAMENTE PROIBIDO utilizar esses tópicos divididos. Toda a explicação deve ser redigida em um único parágrafo textual, fluido, coeso e narrativo, integrando a condição, a resposta do gestor e a análise da equipe de fiscalização conforme o exemplo acima.
2. Inicie cada achado com a linha: "ACHADO X: [Título do Achado]" (ex: ACHADO 1: ..., ACHADO 2: ...).
3. Pule UMA linha em branco antes de iniciar o parágrafo narrativo.
4. Pule UMA linha em branco entre o parágrafo narrativo e a linha "- CONCLUSÃO: [Achado Sanado / Não Sanado]".
5. Pule DUAS linhas em branco antes de iniciar o próximo ACHADO.
6. Preserve sempre as alíneas e itens (a), (b), (c)... existentes no relatório original para manter a precisão técnica.

Texto do Relatório: "${reportText}"`;
    
    try {
        return await generateText(prompt);
    } catch (error: any) {
        console.error("Error generating summary with Gemini API:", error);
        throw new Error(error.message || "Falha ao gerar o resumo com a IA. Tente novamente.");
    }
};

export const analyzeDemands = async (question: string, demands: Demand[]): Promise<string> => {
    const context = demands
      .map((d) => {
        const nFiscalizacaoLink = d.nFiscalizacao ? generateFiscalizacaoLink(d.nFiscalizacao) : 'N/A';
        const requerimentoExternoLink = d.requerimentoExterno ? generateTceLink(d.requerimentoExterno) : 'N/A';
        const encaminhamentoProcessualLink = d.encaminhamentoProcessual ? generateTceLink(d.encaminhamentoProcessual) : 'N/A';
        const representacaoExternaLink = Array.isArray(d.representacaoExterna)
          ? d.representacaoExterna.map((rep) => (rep ? generateTceLink(rep) || 'N/A' : 'N/A')).join(', ')
          : d.representacaoExterna ? generateTceLink(d.representacaoExterna) || 'N/A' : 'N/A';

        const temRelatorioAnexado = (
          (d.relatorioTextoCompleto && d.relatorioTextoCompleto.trim() !== '') || 
          (d.relatorioArquivos && d.relatorioArquivos.length > 0) || 
          (d.relatorioNomeArquivo && d.relatorioNomeArquivo.trim() !== '')
        ) ? 'SIM' : 'NÃO';

        const nomeRelatorio = d.relatorioNomeArquivo || (d.relatorioArquivos && d.relatorioArquivos.length > 0 ? d.relatorioArquivos.map(f => f.nome).join(', ') : 'NENHUM');

        const temResumoIA = (d.resumoRelatorio && d.resumoRelatorio.trim() !== '') ? 'SIM' : 'NÃO';

        return `--- INÍCIO FISCALIZAÇÃO ID: ${d.id} ---
Ano do Exercício: ${d.ano || 'N/A'}
Município: ${d.municipio || 'N/A'}
Modalidade: ${d.modalidade || 'N/A'}
Tema: ${d.tema || 'N/A'}
Valor Estimado (R$): ${d.valor && !isNaN(parseBRNumber(d.valor)) ? parseBRNumber(d.valor).toFixed(2) : 'N/A'}
Status Atual: ${d.status || 'N/A'}
Nº da Fiscalização: ${d.nFiscalizacao || 'N/A'} (Link: ${nFiscalizacaoLink})
Protocolo Requerimento Externo: ${d.requerimentoExterno || 'N/A'} (Link: ${requerimentoExternoLink})
Data Req. Externo: ${d.dataReqExterno || 'N/A'}
Representação Externa: ${Array.isArray(d.representacaoExterna) ? d.representacaoExterna.join(', ') : d.representacaoExterna || 'N/A'} (Link: ${representacaoExternaLink})
Encaminhamento Processual: ${d.encaminhamentoProcessual || 'N/A'} (Link: ${encaminhamentoProcessualLink})
Possui Arquivo/Relatório Anexado: ${temRelatorioAnexado}
Nome do(s) Arquivo(s) Anexado(s): ${nomeRelatorio}
Possui Resumo de Relatório por IA: ${temResumoIA}
Observações / Notas: ${d.observacoes?.replace(/<[^>]+>/g, '') || 'N/A'}
Resumo do Relatório (IA): ${d.resumoRelatorio || 'N/A'}
--- FIM FISCALIZAÇÃO ---`;
      })
      .join('\n\n');
    
    if (!context.trim()) {
        throw new Error("Nenhum dado de fiscalização disponível para análise.");
    }

    const prompt = `Você é um Consultor Especialista de Inteligência de Controle Externo do Tribunal de Contas.
Sua missão é responder à pergunta do usuário sobre as demandas e fiscalizações com EXTREMA PRECISÃO, LINGUAGEM EM PORTUGUÊS DO BRASIL E FORMATO ALTAMENTE VISUAL, ORGANIZADO E ESTRUTURADO.

ESTRUTURA DE RELATÓRIOS E TÓPICOS DE AUDITORIA:
- Note que os relatórios de fiscalização e resumos contêm tópicos e achados estruturados (ex: "ACHADO X: [Título]"), contendo o detalhamento narrativo da irregularidade (condição), a resposta do gestor, a fundamentação técnica da equipe de fiscalização e o desfecho (- CONCLUSÃO: Achado Sanado / Não Sanado).
- Quando a pergunta do usuário for sobre achados, pareceres técnicos, justificativas ou análises realizadas pela fiscalização, extraia e destaque com clareza o posicionamento técnico e a conclusão de cada achado.

REGRAS CRÍTICAS DE IDIOMA E FORMATAÇÃO (OBRIGATÓRIO):
1. Responda SEMPRE E EXCLUSIVAMENTE em Português do Brasil (pt-BR). É absolutamente proibido responder em inglês.
2. Quando a pergunta se referir a CADASTROS, LISTAGENS, STATUS, CONTAGEM, FILTROS OU DADOS ADMINISTRATIVOS (por exemplo: "quais fiscalizações...", "quais não têm relatórios/arquivos anexados", "quais estão pendentes", "quais municípios têm fiscalização de tema X", "lista por status"):
   - Apresente primeiro uma **Síntese / Resumo em Destaque** com a contagem total identificada de fiscalizações e percentual/visão quantitativa.
   - Em seguida, formate a lista de fiscalizações como **CARDS VISUAIS EM HTML/MARKDOWN** bem estruturados.

FORMATO DOS CARDS DE FISCALIZAÇÃO (Use este padrão HTML visual para cada item listado):
<div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
    <strong style="color: #1e1b4b; font-size: 14px;">📍 [Município] — [Tema] ([Ano])</strong>
    <span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 10px; border-radius: 20px; font-weight: bold; font-size: 11px;">[Status]</span>
  </div>
  <div style="font-size: 12px; color: #334155; line-height: 1.6;">
    <p style="margin: 2px 0;"><strong>Nº Fiscalização:</strong> [Link HTML ou N/A]</p>
    <p style="margin: 2px 0;"><strong>Requerimento Externo:</strong> [Link HTML ou N/A]</p>
    <p style="margin: 2px 0;"><strong>Encaminhamento Processual:</strong> [Link HTML ou N/A]</p>
    <p style="margin: 2px 0;"><strong>Arquivo / Relatório Anexado:</strong> [❌ Nenhum arquivo anexado OU 📄 Nome do Arquivo]</p>
  </div>
</div>

REGRAS DE LINKS HTML (OBRIGATÓRIO):
- Sempre que citar o Nº da Fiscalização, insira o link HTML no formato <a href="link" target="_blank" rel="noopener noreferrer">Inspeção nº xx/xx</a> se o link for diferente de "N/A".
- Para Requerimento Externo, Representação Externa e Encaminhamento Processual, se houver link válido diferente de "N/A", use <a href="link" target="_blank" rel="noopener noreferrer">protocolo</a>. Se o link for "N/A", escreva apenas o protocolo ou "N/A".

SE NENHUMA FISCALIZAÇÃO ATENDER AO FILTRO:
Responda de forma clara e amigável em português explicando que nenhuma fiscalização com os critérios informados foi encontrada na base de dados.

REGRAS DE CONCLUSÃO E INTEGRIDADE DA RESPOSTA (CRÍTICO):
- CERTIFIQUE-SE DE CONCLUIR E FINALIZAR TOTALMENTE SUA RESPOSTA. NUNCA DEIXE NENHUMA FRASE, ITEM, LISTA OU PARÁGRAFO PELA METADE OU CORTADO.
- Desenvolva cada tópico e explicitação de achado com clareza e feche todas as orações e marcadores antes de prosseguir.

CONTEXTO DAS FISCALIZAÇÕES:
${context}

PERGUNTA DO USUÁRIO:
"${question}"`;

    try {
        return await generateText(prompt);
    } catch (error: any) {
        console.error("Error analyzing demands with Gemini API:", error);
        throw new Error(error.message || "Falha ao analisar as demandas com a IA. Tente novamente.");
    }
};

export const generateAuditFinding = async (situation: string, demands: Demand[], uploadedReportText?: string): Promise<string> => {
    const reportsContext = demands
      .filter(d => d.resumoRelatorio && d.resumoRelatorio.trim() !== '')
      .map(d => {
        return `[Resumo do Relatório de Auditoria registrado]
${d.resumoRelatorio}`;
      })
      .join('\n\n-----------------------------------\n\n');

    const demandFullReportsContext = demands
      .filter(d => d.relatorioTextoCompleto && d.relatorioTextoCompleto.trim() !== '')
      .map(d => `[TEXTO DO RELATÓRIO ANEXADO NA FISCALIZAÇÃO - Ano: ${d.ano}, Tema: ${d.tema || 'N/A'}]:\n${d.relatorioTextoCompleto?.slice(0, 8000)}`)
      .join('\n\n-----------------------------------\n\n');

    const uploadedContext = uploadedReportText && uploadedReportText.trim() !== ''
      ? `\n\n=== TEXTO DE RELATÓRIO(S) ANEXADO(S) NO MOMENTO DA CONSULTA ===\n${uploadedReportText.slice(0, 15000)}\n=== FIM DO TEXTO ANEXADO ===\n`
      : '';

    const prompt = `Você é um Auditor de Controle Externo sênior especialista em fiscalizações governamentais e normas do Tribunal de Contas.
Sua tarefa é elaborar um **Texto de Achado de Auditoria completo, técnico e estruturado**, utilizando como subsídio a SITUAÇÃO ESPECÍFICA fornecida pelo usuário combinada com a fundamentação técnica e jurídica dos relatórios de auditoria disponíveis (resumos do sistema e/ou relatórios na íntegra anexados).

SITUAÇÃO / PROBLEMA APRESENTADO PELO AUDITOR:
"${situation}"

BASE DE RELATÓRIOS DISPONÍVEIS:
${uploadedContext}
${demandFullReportsContext}
${reportsContext || "Nenhum resumo prévio registrado nas demandas. Utilize a situação apresentada e normas gerais de auditoria pública."}

REGRA CRÍTICA DE PRIVACIDADE E REDAÇÃO PÚBLICA (OBRIGATÓRIO):
1. O texto do Achado de Auditoria é um documento oficial público. É **EXTREMAMENTE PROIBIDO** citar nomes de municípios específicos (ex: "Município de Rio Negro", "Almirante Tamandaré"), números de fiscalização (ex: "184/264"), números de achados prévios ou referências nominais a processos anteriores.
2. NUNCA escreva frases como "como observado no município X" ou "conforme Fiscalização N. Y".
3. Em vez disso, extraia dos relatórios anteriores (especialmente dos quadros/seções "Análise da Equipe" ou "Análise da Equipe de Auditoria") os **ARGUMENTOS TÉCNICOS ABSTRATOS, DOUTRINA, JURISPRUDÊNCIA DO TRIBUNAL DE CONTAS, RISCOS E LÓGICA DE CONTROLE EXTERNO**, incorporando essa fundamentação técnica diretamente na **SITUAÇÃO ENCONTRADA (CONDIÇÃO)**.

REGRAS DE ESTRUTURAÇÃO DAS SEÇÕES (OBRIGATÓRIO):
- **2. SITUAÇÃO ENCONTRADA (CONDIÇÃO)**: Deve conter a descrição detalhada dos fatos e da irregularidade no caso concreto, trazendo também toda a **Análise Técnica da Equipe**, fundamentação teórica, argumentos doutrinários, demonstrativos de falhas de planejamento ou telegestão e justificativas técnicas de forma impessoal e aprofundada.
- **3. CRITÉRIO DE AUDITORIA (FUNDAMENTAÇÃO LEGAL)**: Deve conter **SOMENTE O CRITÉRIO LEGAL / DISPOSITIVOS NORMATIVOS ENQUADRADOS** (ex: *Lei Federal nº 11.079/2004, art. 4º, incisos I e VII; Lei Federal nº 14.133/2021, art. 11, inc. I; Constituição Federal, art. 37, caput; Resolução nº X/TCE*). NÃO insira argumentos narrativos ou textos longos de justificativa neste tópico 3 — limite-se aos artigos, incisos, leis, resoluções e princípios normativos aplicáveis.

Sua resposta DEVE conter rigorosamente a seguinte estrutura em HTML simples (use <h3>, <p>, <ul>, <li>, <strong>):

<h3>1. TÍTULO DO ACHADO DE AUDITORIA</h3>
<p>[Título técnico objetivo no padrão de controle externo]</p>

<h3>2. SITUAÇÃO ENCONTRADA (CONDIÇÃO)</h3>
<p>[Descrição detalhada dos fatos, irregularidade concreta e toda a fundamentação e argumentos técnicos extraídos do histórico e das Análises da Equipe, desenvolvidos de forma impessoal e completa]</p>

<h3>3. CRITÉRIO DE AUDITORIA (FUNDAMENTAÇÃO LEGAL)</h3>
<p>[Relação exclusiva das normas, leis, artigos, incisos e dispositivos legais aplicáveis ao caso (ex: Lei Federal nº 11.079/2004, art. 4º, incisos I e VII; Lei Federal nº 14.133/2021; CF/88, art. 37)]</p>

<h3>4. CAUSA E EFEITO (IMPACTO E RISCO)</h3>
<p>[Fragilidades de controle interno identificadas e os riscos de danos ao erário, ineficiência ou prejuízos sociais]</p>

<h3>5. RECOMENDAÇÕES E CONCLUSÃO</h3>
<ul>
  <li>[Recomendação corretiva 1 para a gestão]</li>
  <li>[Recomendação corretiva 2 para a gestão]</li>
</ul>

Responda sempre em Português do Brasil com linguagem técnica de auditoria do Tribunal de Contas.`;

    try {
        return await generateText(prompt);
    } catch (error: any) {
        console.error("Error generating audit finding with Gemini API:", error);
        throw new Error(error.message || "Falha ao gerar o texto do Achado de Auditoria. Verifique a conexão com a API.");
    }
};
