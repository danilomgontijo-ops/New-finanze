import { Transaction, TransactionType, PaymentMethod, CreditCard, UserSettings } from '../types';

// Fonte única para "em qual mês essa transação conta" (fatura de cartão fechada,
// dia de salário/shift, data manual de competência). Usada por Dashboard,
// Analytics, TransactionsList e ReportGenerator — mantenha qualquer ajuste aqui
// para não deixar as telas divergirem entre si.
export function calculateEffectiveDate(t: Transaction, creditCards: CreditCard[] = [], settings?: UserSettings): Date {
    if (t.manualAccountingDate) {
        const mDate = new Date(t.manualAccountingDate);
        if (!isNaN(mDate.getTime())) return mDate;
    }
    let date = new Date(t.date);
    if (isNaN(date.getTime())) date = new Date();
    const dayOfMonth = t.originalDay || date.getUTCDate();
    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const comparisonDate = new Date(year, month, 1, 12, 0, 0);

    if (t.type === TransactionType.INVESTMENT) {
        return comparisonDate;
    }

    if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId) {
        const card = creditCards.find(c => c.id === t.creditCardId);
        if (card && dayOfMonth > card.closingDay) {
            comparisonDate.setMonth(comparisonDate.getMonth() + 1);
        }
    } else {
        const salaryDay = settings?.salaryDay || 1;
        const shift = settings?.salaryShift ?? (salaryDay >= 20 ? 1 : 0);
        const lastDayOfMonth = new Date(comparisonDate.getFullYear(), comparisonDate.getMonth() + 1, 0).getDate();
        const effectiveSalaryDay = Math.min(salaryDay, lastDayOfMonth);

        if (dayOfMonth >= effectiveSalaryDay) {
            comparisonDate.setMonth(comparisonDate.getMonth() + shift);
        } else {
            comparisonDate.setMonth(comparisonDate.getMonth() + shift - 1);
        }
    }
    return comparisonDate;
}
