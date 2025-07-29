/**
 * Transaction History Component
 * Displays credit transaction history with filtering and pagination
 */

'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Download,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { CreditTransaction } from '@/lib/database/schema';
import { SelectChangeEvent } from '@/lib/types/common';

interface TransactionHistoryProps {
  transactions: CreditTransaction[];
  organizationId: string;
}

export function TransactionHistory({
  transactions: initialTransactions,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState<'all' | 'purchase' | 'usage'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFilterChange = (newFilter: 'all' | 'purchase' | 'usage') => {
    setFilter(newFilter);
    // Apply filtering logic
    filterAndSortTransactions(newFilter, sortBy, sortOrder, searchTerm);
  };

  const handleSortChange = (newSortBy: 'date' | 'amount') => {
    const newOrder =
      sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    filterAndSortTransactions(filter, newSortBy, newOrder, searchTerm);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    filterAndSortTransactions(filter, sortBy, sortOrder, term);
  };

  const filterAndSortTransactions = (
    filterType: string,
    sortField: string,
    order: string,
    search: string,
  ) => {
    let filtered = [...initialTransactions];

    // Apply filter
    if (filterType !== 'all') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Apply search
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.type.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      if (sortField === 'date') {
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
      } else {
        aValue = Math.abs(parseFloat(a.amount));
        bValue = Math.abs(parseFloat(b.amount));
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setTransactions(filtered);
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'csv',
          filter,
          startDate: null, // TODO: Add date range picker
          endDate: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export transactions');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return '💳';
      case 'usage':
        return '🔧';
      case 'refund':
        return '↩️';
      default:
        return '📄';
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    if (type === 'purchase' || amount > 0) {
      return 'text-green-600';
    } else {
      return 'text-red-600';
    }
  };

  const formatAmount = (amount: number) => {
    const prefix = amount > 0 ? '+' : '';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-6"
      data-testid="transaction-history"
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2
          className="text-xl font-semibold text-gray-900"
          data-testid="transactions-title"
        >
          Transaction History
        </h2>
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          data-testid="export-transactions"
        >
          <Download className="mr-1 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export'}
        </button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            data-testid="transaction-search"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e: SelectChangeEvent) =>
              handleFilterChange(e.target.value as 'all' | 'purchase' | 'usage')
            }
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            data-testid="transaction-filter"
          >
            <option value="all">All Transactions</option>
            <option value="purchase">Purchases</option>
            <option value="usage">Usage</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex space-x-1">
          <button
            onClick={() => handleSortChange('date')}
            className={`flex items-center rounded-lg border px-3 py-2 text-sm ${
              sortBy === 'date'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            data-testid="sort-by-date"
          >
            Date <ArrowUpDown className="ml-1 h-3 w-3" />
          </button>
          <button
            onClick={() => handleSortChange('amount')}
            className={`flex items-center rounded-lg border px-3 py-2 text-sm ${
              sortBy === 'amount'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            data-testid="sort-by-amount"
          >
            Amount <ArrowUpDown className="ml-1 h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3" data-testid="transaction-list">
        {transactions.length === 0 ? (
          <div className="py-8 text-center" data-testid="no-transactions">
            <p className="text-gray-500">No transactions found</p>
            {searchTerm && (
              <p className="mt-1 text-sm text-gray-400">
                Try adjusting your search or filter criteria
              </p>
            )}
          </div>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100"
              data-testid="transaction-item"
            >
              <div className="flex items-center space-x-4">
                <span className="text-2xl" data-testid="transaction-icon">
                  {getTransactionIcon(transaction.type)}
                </span>
                <div>
                  <p
                    className="font-medium text-gray-900"
                    data-testid="transaction-description"
                  >
                    {transaction.description}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span data-testid="transaction-date">
                      {new Date(transaction.createdAt).toLocaleDateString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </span>
                    <span className="capitalize" data-testid="transaction-type">
                      {transaction.type}
                    </span>
                    <span
                      className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"
                      data-testid="transaction-status"
                    >
                      completed
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-semibold ${getTransactionColor(transaction.type, parseFloat(transaction.amount))}`}
                  data-testid="transaction-amount"
                >
                  {formatAmount(parseFloat(transaction.amount))}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {transactions.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              // TODO: Implement pagination
              console.log('Load more transactions');
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
            data-testid="load-more-transactions"
          >
            Load More Transactions
          </button>
        </div>
      )}
    </div>
  );
}
