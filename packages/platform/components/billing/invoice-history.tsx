/**
 * Invoice History Component
 * Displays transaction history with filtering and pagination
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Download,
  Filter,
  Calendar,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'auto_topup';
  amount: number;
  description: string;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  balanceAfter: number;
  metadata: Record<string, any>;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface InvoiceHistoryProps {
  organizationId: string;
}

export function InvoiceHistory({ organizationId }: InvoiceHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
  });

  const [showFilters, setShowFilters] = useState(false);

  const fetchTransactions = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
          ...(filters.type && { type: filters.type }),
          ...(filters.startDate && { startDate: filters.startDate }),
          ...(filters.endDate && { endDate: filters.endDate }),
        });

        const response = await fetch(`/api/billing/transactions?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        setTransactions(data.data?.transactions || data.transactions || []);
        setPagination(
          (prevPagination) =>
            data.data?.pagination || {
              page,
              limit: prevPagination.limit,
              total: data.transactions?.length || 0,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            },
        );
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
        toast.error('Failed to load transaction history');
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit],
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handlePageChange = (newPage: number) => {
    fetchTransactions(newPage);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      startDate: '',
      endDate: '',
    });
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'Credit Purchase';
      case 'usage':
        return 'Usage';
      case 'refund':
        return 'Refund';
      case 'adjustment':
        return 'Manual Adjustment';
      case 'auto_topup':
        return 'Auto Top-up';
      default:
        return type;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'auto_topup':
        return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case 'usage':
        return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
      case 'refund':
        return <ArrowUpCircle className="h-4 w-4 text-blue-600" />;
      case 'adjustment':
        return <Receipt className="h-4 w-4 text-gray-600" />;
      default:
        return <Receipt className="h-4 w-4 text-gray-600" />;
    }
  };

  const downloadInvoice = async (
    transactionId: string,
    stripePaymentIntentId?: string,
  ) => {
    if (!stripePaymentIntentId) {
      toast.error('No invoice available for this transaction');
      return;
    }

    try {
      const response = await fetch(
        `/api/billing/invoice/${stripePaymentIntentId}/download`,
      );
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${transactionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Transaction History
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View all billing transactions and invoices
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Transaction Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">All Types</option>
                <option value="purchase">Credit Purchase</option>
                <option value="usage">Usage</option>
                <option value="refund">Refund</option>
                <option value="adjustment">Manual Adjustment</option>
                <option value="auto_topup">Auto Top-up</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange('startDate', e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Loading transactions...
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-400">
              No transactions found
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Transaction
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          {getTransactionIcon(transaction.type)}
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {formatTransactionType(transaction.type)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {transaction.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div
                          className={`text-sm font-medium ${
                            transaction.amount >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {transaction.amount >= 0 ? '+' : ''}$
                          {Math.abs(transaction.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Balance: ${transaction.balanceAfter.toFixed(2)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center text-sm text-gray-900">
                          {transaction.paymentMethod === 'stripe' && (
                            <CreditCard className="mr-1 h-4 w-4" />
                          )}
                          {transaction.paymentMethod || 'N/A'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                        {transaction.stripePaymentIntentId && (
                          <button
                            onClick={() =>
                              downloadInvoice(
                                transaction.id,
                                transaction.stripePaymentIntentId,
                              )
                            }
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-900"
                          >
                            <Download className="h-4 w-4" />
                            Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-gray-200 md:hidden">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      {getTransactionIcon(transaction.type)}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {formatTransactionType(transaction.type)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {transaction.description}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-medium ${
                          transaction.amount >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {transaction.amount >= 0 ? '+' : ''}$
                        {Math.abs(transaction.amount).toFixed(2)}
                      </div>
                      {transaction.stripePaymentIntentId && (
                        <button
                          onClick={() =>
                            downloadInvoice(
                              transaction.id,
                              transaction.stripePaymentIntentId,
                            )
                          }
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-900"
                        >
                          <Download className="h-3 w-3" />
                          Invoice
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} transactions
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <span className="text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
