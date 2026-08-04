import * as ofx from 'ofx-js';

export interface ParsedBankTransaction {
  ofx_fitid: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive number
  description: string;
  type: 'credit' | 'debit';
  raw_data?: any;
}

/**
  Parse OFX file content into standardized ParsedBankTransaction list.
 */
export async function parseOFX(content: string): Promise<ParsedBankTransaction[]> {
  const transactions: ParsedBankTransaction[] = [];

  try {
    // Try using ofx-js library
    const data = await ofx.parse(content);
    const stmtTrns =
      data?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN ||
      data?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS?.BANKTRANLIST?.STMTTRN ||
      [];

    const trnArray = Array.isArray(stmtTrns) ? stmtTrns : stmtTrns ? [stmtTrns] : [];

    for (const trn of trnArray) {
      const rawAmt = parseFloat(trn.TRNAMT || '0');
      const amount = Math.abs(rawAmt);
      const type: 'credit' | 'debit' = rawAmt >= 0 ? 'credit' : 'debit';
      const rawDate = trn.DTPOSTED || '';
      
      // DTPOSTED format: YYYYMMDDHHMMSS or YYYYMMDD
      let formattedDate = new Date().toISOString().split('T')[0];
      if (rawDate.length >= 8) {
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        formattedDate = `${year}-${month}-${day}`;
      }

      const description = (trn.MEMO || trn.NAME || trn.PAYEE || 'Transação Bancária').trim();
      const fitid = (trn.FITID || `OFX_${formattedDate}_${amount}_${description.replace(/\s+/g, '_')}`).trim();

      transactions.push({
        ofx_fitid: fitid,
        date: formattedDate,
        amount,
        description,
        type,
        raw_data: trn,
      });
    }

    if (transactions.length > 0) {
      return transactions;
    }
  } catch (err) {
    console.warn('ofx-js parse error, falling back to regex parser:', err);
  }

  // Fallback Regex parser for OFX/SGML tags (<STMTTRN>...)
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = trnRegex.exec(content)) !== null) {
    const block = match[1];

    const getTag = (tag: string) => {
      const tagMatch = new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, 'i').exec(block);
      return tagMatch ? tagMatch[1].trim() : '';
    };

    const trnType = getTag('TRNTYPE');
    const dtPosted = getTag('DTPOSTED');
    const trnAmt = getTag('TRNAMT');
    const fitId = getTag('FITID');
    const memo = getTag('MEMO') || getTag('NAME') || 'Transação OFX';

    const rawAmt = parseFloat(trnAmt.replace(',', '.') || '0');
    const amount = Math.abs(rawAmt);
    const type: 'credit' | 'debit' = rawAmt >= 0 ? 'credit' : 'debit';

    let formattedDate = new Date().toISOString().split('T')[0];
    if (dtPosted.length >= 8) {
      formattedDate = `${dtPosted.substring(0, 4)}-${dtPosted.substring(4, 6)}-${dtPosted.substring(6, 8)}`;
    }

    const fitid = fitId || `OFX_${formattedDate}_${amount}_${memo.replace(/\s+/g, '_')}`;

    transactions.push({
      ofx_fitid: fitid,
      date: formattedDate,
      amount,
      description: memo,
      type,
      raw_data: { trnType, dtPosted, trnAmt, fitId, memo },
    });
  }

  return transactions;
}

/**
 * Parse Sicoob / standard bank CSV content
 * Expected format: Data;Descrição/Histórico;Valor;Tipo
 * or: Data;Histórico;Valor
 */
export function parseCSV(content: string, _accountId?: string): ParsedBankTransaction[] {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return [];

  const delimiter = content.includes(';') ? ';' : ',';
  const transactions: ParsedBankTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || i === 0 && (line.toLowerCase().includes('data') || line.toLowerCase().includes('date'))) {
      continue; // Skip header
    }

    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    // Col 0: Date (DD/MM/YYYY or YYYY-MM-DD)
    const rawDate = cols[0];
    let formattedDate = new Date().toISOString().split('T')[0];

    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        formattedDate = `${year}-${month}-${day}`;
      }
    } else if (rawDate.includes('-')) {
      formattedDate = rawDate;
    }

    // Col 1: Description
    const description = cols[1] || 'Lançamento CSV';

    // Col 2: Amount (e.g. 1500.00 or -1500,00 or 1.500,00)
    let rawAmtStr = cols[2] || '0';
    let typeOverride: 'credit' | 'debit' | null = null;

    if (cols[3]) {
      const typeCol = cols[3].toLowerCase();
      if (typeCol.includes('c') || typeCol.includes('credito') || typeCol.includes('crédito') || typeCol.includes('entrada')) {
        typeOverride = 'credit';
      } else if (typeCol.includes('d') || typeCol.includes('debito') || typeCol.includes('débito') || typeCol.includes('saida') || typeCol.includes('saída')) {
        typeOverride = 'debit';
      }
    }

    // Clean monetary string
    let cleanedAmt = rawAmtStr.replace(/[R$\s]/gi, '');
    if (/\d+\.\d+,\d+/.test(cleanedAmt)) {
      cleanedAmt = cleanedAmt.replace(/\./g, '').replace(',', '.');
    } else if (cleanedAmt.includes(',') && !cleanedAmt.includes('.')) {
      cleanedAmt = cleanedAmt.replace(',', '.');
    }

    const parsedAmt = parseFloat(cleanedAmt);
    if (isNaN(parsedAmt) || parsedAmt === 0) continue;

    const amount = Math.abs(parsedAmt);
    const type: 'credit' | 'debit' = typeOverride
      ? typeOverride
      : (parsedAmt >= 0 ? 'credit' : 'debit');

    const cleanDescSlug = description.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 20);
    const fitid = `CSV_${formattedDate}_${amount}_${cleanDescSlug}_${i}`;

    transactions.push({
      ofx_fitid: fitid,
      date: formattedDate,
      amount,
      description,
      type,
      raw_data: { line, cols },
    });
  }

  return transactions;
}
