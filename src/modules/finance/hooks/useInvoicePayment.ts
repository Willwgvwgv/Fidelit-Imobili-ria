import { useState } from 'react';
import { FinancialAccount } from '../../../../types';

export const useInvoicePayment = () => {
  const [payInvoiceModalOpen, setPayInvoiceModalOpen] = useState(false);
  const [payInvoiceSourceAccountId, setPayInvoiceSourceAccountId] = useState('');
  const [payInvoiceAmountStr, setPayInvoiceAmountStr] = useState('');
  const [payInvoiceDate, setPayInvoiceDate] = useState('');
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<FinancialAccount | null>(null);

  const resetInvoicePaymentStates = () => {
    setPayInvoiceModalOpen(false);
    setPayInvoiceSourceAccountId('');
    setPayInvoiceAmountStr('');
    setPayInvoiceDate('');
    setSelectedCardForPayment(null);
  };

  return {
    payInvoiceModalOpen,
    setPayInvoiceModalOpen,
    payInvoiceSourceAccountId,
    setPayInvoiceSourceAccountId,
    payInvoiceAmountStr,
    setPayInvoiceAmountStr,
    payInvoiceDate,
    setPayInvoiceDate,
    selectedCardForPayment,
    setSelectedCardForPayment,
    resetInvoicePaymentStates
  };
};
