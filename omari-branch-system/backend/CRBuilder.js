import React, { useEffect, useState, useMemo, useRef, useCallback  } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Box, Card, CardContent, Typography, Container, Grid, 
  IconButton, Divider, TextField, Button, Backdrop, 
  CircularProgress, Alert, Snackbar, InputAdornment,Menu,
  Table,Modal, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, MenuItem,Checkbox,ListItemText,Chip
} from "@mui/material";
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Line, Bar } from "react-chartjs-2";
import { FixedSizeList as List } from 'react-window';
import AutoSizer from "react-virtualized-auto-sizer";
import axios from "axios";
import * as XLSX from 'xlsx';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import DownloadIcon from '@mui/icons-material/Download';
import Layout from "../layout/layout";
import CustomerCohortAnalyzer from './CustomerCohortAnalyzer';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { getUserInfo, getDBInfo } from "../APIServices/localstore";


// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState('text');
  const [searchQuery, setSearchQuery] = useState('');
  
const [filters, setFilters] = useState({
  transactionTypes: [],
  networkProviders: [], // For Airtime Purchase
  bundleProviders: [], // For Bundle Purchase
  remittanceProviders: [], // For Remittances
  visaMerchants: [], // For VISA Purchase Completion
  terminalType: 'All', // Add this line - options: 'All', 'POS', 'ATM', 'Online'
  dateRange: 'month',
  currency: 'USD',
  fromDate: '',
  toDate: '',
  amountFilter: 'none', // Add if not present
  amountValue: '' // Add if not present
});

const [filterConfirmation, setFilterConfirmation] = useState({
  open: false,
  filters: null
});
 const [viewMode, setViewMode] = useState('detailed'); // 'detailed' or 'comprehensive'
 const [showChatInterface, setShowChatInterface] = useState(false);
  // const [transactionTypes, setTransactionTypes] = useState([]);
  // const [loading, setLoading] = useState(false);
  
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isBackdropOpen, setIsBackdropOpen] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [aggregation, setAggregation] = useState('weekly');
  const [totalUniqueUsers, setTotalUniqueUsers] = useState([]);
  const [monthlyComboUsers, setMonthlyComboUsers] = useState([]);
  const [totalComboUsers, setTotalComboUsers] = useState([]);
  const [comparativeData, setComparativeData] = useState([]);
  const transactionTypes = [
  'All',
  'Account Bundle',
  'Airtime Purchase',
  'B2W Credit',
  'BillPayment',
  'Bundle Purchase',
  'Balance Inquiry',
  'Cash In debit',
  'Cash In credit',
  'Cash in for other debit',
  'Mama Money Agent Credit',
  'Merchant Purchase',
  'Purchase',
  'Remittances',
  'SendToCell Send',
  'Transfer-Send-Omari',
  'VISA', 
  'Withdrawal (CashOut)',
  'ZIPIT-Receive',
  'ZIPIT-Send'
];
  // Add this state declaration near your other state declarations
const [monthlyUniqueUsers, setMonthlyUniqueUsers] = useState([]);

// VISA Subtype Selection Popup
const [visaSubtypePopup, setVisaSubtypePopup] = useState({
  open: false,
  selectedTypes: [],
  pendingFilters: null
});

  useEffect(() => {
    const isLoggedin = sessionStorage.getItem("isLoggedin");
    if (isLoggedin !== "true") {
      navigate(`/`);
    }
  }, [navigate]);

useEffect(() => {
  if (filteredData.length === 0) {
    setIsBackdropOpen(true);
  }
}, []);
// Add this near your other state declarations (around line 100-150)
const [visaMerchantAnalyticsLoading, setVisaMerchantAnalyticsLoading] = useState(false);
const [visaMerchantsList, setVisaMerchantsList] = useState([]);
const [visaTableLoading, setVisaTableLoading] = useState(false);
const [merchantPagination, setMerchantPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0
});

// Add these near your other state declarations
const [searchResults, setSearchResults] = useState([]); // Store current search results
const [showPlayAroundPopup, setShowPlayAroundPopup] = useState(false);
const [selectedPlayAroundMerchants, setSelectedPlayAroundMerchants] = useState([]);
const [combinedAnalysis, setCombinedAnalysis] = useState(null);
const [analysisLoading, setAnalysisLoading] = useState(false);


const [merchantSort, setMerchantSort] = useState({ field: 'TotalVolume', order: 'DESC' });
const [merchantSearch, setMerchantSearch] = useState('');
const [merchantPageSize, setMerchantPageSize] = useState(20);
const [showVisaMerchantsTable, setShowVisaMerchantsTable] = useState(false);
// Add this state to track if filters have been applied
const [filtersApplied, setFiltersApplied] = useState(false);
// Add these states near your other state declarations
const [visaMerchantsEnhanced, setVisaMerchantsEnhanced] = useState([]);
const [merchantPaginationEnhanced, setMerchantPaginationEnhanced] = useState({
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0
});
  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };
// Add this near your other state declarations
const [totalSearchResults, setTotalSearchResults] = useState(0);
const [merchantSortEnhanced, setMerchantSortEnhanced] = useState({ field: 'TotalVolume', order: 'DESC' });
const [merchantSearchEnhanced, setMerchantSearchEnhanced] = useState('');
const [showVisaMerchantsEnhanced, setShowVisaMerchantsEnhanced] = useState(false);
const [visaOverallStats, setVisaOverallStats] = useState(null);
const isEditingFilters = useRef(false);
// Add a new state for export loading
const [exportLoading, setExportLoading] = useState(false);
// Add this at the top of your Dashboard component (if not already there)
// Export all VISA merchants to Excel
const exportAllVisaMerchants = async () => {
    try {
        setExportLoading(true);
        
        // Call API with large pageSize to get all merchants
        const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-merchants-enhanced', {
            dateRange: filters.dateRange,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            amountFilter: filters.amountFilter,
            amountValue: filters.amountValue,
            page: 1,
            pageSize: 100000, // Large number to get all merchants
            sortBy: merchantSortEnhanced.field,
            sortOrder: merchantSortEnhanced.order,
            searchTerm: merchantSearchEnhanced
        });
        
        const allMerchants = response.data.merchants;
        const stats = response.data.overallStats;
        
        if (!allMerchants || allMerchants.length === 0) {
            setSnackbar({
                open: true,
                message: 'No merchant data to export',
                severity: 'warning'
            });
            return;
        }
        
        // Generate date range string for filename
        let dateRangeStr = '';
        
        if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
            const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            dateRangeStr = ` (${from} to ${to})`;
        } else if (filters.dateRange !== 'custom') {
            const now = new Date();
            let rangeText = '';
            
            switch (filters.dateRange) {
                case 'day':
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    break;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    rangeText = weekStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    break;
                case 'month':
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    break;
                default:
                    rangeText = 'All Time';
            }
            
            dateRangeStr = ` (${rangeText})`;
        }
        
        // Prepare worksheet data
        const worksheetData = allMerchants.map(merchant => ({
            'Merchant Name': merchant.MerchantName,
            'Unique Customers': merchant.UniqueCustomers,
            'Total Volume': merchant.TotalVolume,
            'Total Value': merchant.TotalValue,
            'Avg Transaction Value': merchant.AvgTransactionValue,
            'Min Transaction Value': merchant.MinTransactionValue,
            'Max Transaction Value': merchant.MaxTransactionValue,
            'Total Fees': merchant.TotalFees,
            'Avg Fee': merchant.AvgFee
        }));
        
        // Add summary info
        const summaryData = [
            ['VISA Merchant Export Report', ''],
            ['Date Range:', dateRangeStr.replace(/[()]/g, '')],
            ['Generated:', new Date().toLocaleString()],
            ['', ''],
            ['Overall Statistics', ''],
            ['Merchants in Date Range:', stats?.totalMerchants?.toLocaleString() || '0'],
            ['Total Merchants (All Time):', stats?.totalAllMerchants?.toLocaleString() || '0'],
            ['Coverage:', `${((stats?.totalMerchants / stats?.totalAllMerchants) * 100).toFixed(2)}%`],
            ['Total Unique Customers:', stats?.totalUniqueCustomers?.toLocaleString() || '0'],
            ['Total Volume:', stats?.totalVolume?.toLocaleString() || '0'],
            ['Total Value:', formatCurrency(stats?.totalValue || 0)],
            ['', ''],
            ['Merchant Details (Total: ' + allMerchants.length + ' merchants)', '']
        ];
        
        const workbook = XLSX.utils.book_new();
        
        // Create worksheet with summary and merchant list
        const worksheet = XLSX.utils.json_to_sheet([], { header: [] });
        XLSX.utils.sheet_add_aoa(worksheet, summaryData);
        XLSX.utils.sheet_add_json(worksheet, worksheetData, { origin: summaryData.length + 1 });
        
        // Set column widths
        worksheet['!cols'] = [
            { wch: 40 }, // Merchant Name
            { wch: 15 }, // Unique Customers
            { wch: 15 }, // Total Volume
            { wch: 15 }, // Total Value
            { wch: 15 }, // Avg Transaction Value
            { wch: 15 }, // Min Transaction Value
            { wch: 15 }, // Max Transaction Value
            { wch: 15 }, // Total Fees
            { wch: 15 }  // Avg Fee
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'VISA Merchants');
        
        XLSX.writeFile(workbook, `visa-merchants${dateRangeStr}.xlsx`);
        
        setSnackbar({
            open: true,
            message: `Exported ${allMerchants.length} merchants`,
            severity: 'success'
        });
        
    } catch (err) {
        console.error('Error exporting VISA merchants:', err);
        setSnackbar({
            open: true,
            message: 'Error exporting merchants',
            severity: 'error'
        });
    } finally {
        setExportLoading(false);
    }
};

useEffect(() => {
    const fetchEnhancedVisaMerchants = async () => {
        const hasVisa = filters.transactionTypes.includes('VISA') || 
                        filters.transactionTypes.length === 0 ||
                        filters.transactionTypes.includes('All');
        
        const hasVisaSubTypes = filters.visaSubTypes && filters.visaSubTypes.length > 0;
        
        if (!hasVisa || !hasVisaSubTypes || filteredData.length === 0) {
            setVisaMerchantsEnhanced([]);
            setVisaOverallStats(null);
            setShowVisaMerchantsEnhanced(false);
            setVisaTableLoading(false);
            setTotalSearchResults(0);
            return;
        }
        
        try {
            setVisaTableLoading(true);
            const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-merchants-enhanced', {
                dateRange: filters.dateRange,
                fromDate: filters.fromDate,
                toDate: filters.toDate,
                amountFilter: filters.amountFilter,
                amountValue: filters.amountValue,
                page: merchantPaginationEnhanced.currentPage,
                pageSize: merchantPaginationEnhanced.pageSize,
                sortBy: merchantSortEnhanced.field,
                sortOrder: merchantSortEnhanced.order,
                searchTerm: merchantSearchEnhanced,
                terminalType: filters.terminalType || 'All',
                visaSubTypes: filters.visaSubTypes  // ← Add this line to pass selected subtypes
            });
            
            setVisaMerchantsEnhanced(response.data.merchants || []);
            setVisaOverallStats(response.data.overallStats);
            setTotalSearchResults(response.data.pagination.totalCount);
            setMerchantPaginationEnhanced({
                currentPage: response.data.pagination.currentPage,
                pageSize: response.data.pagination.pageSize,
                totalCount: response.data.pagination.totalCount,
                totalPages: response.data.pagination.totalPages
            });
            setShowVisaMerchantsEnhanced(response.data.merchants && response.data.merchants.length > 0);
        } catch (err) {
            console.error('Error fetching enhanced VISA merchants:', err);
            setVisaMerchantsEnhanced([]);
            setVisaOverallStats(null);
            setShowVisaMerchantsEnhanced(false);
            setTotalSearchResults(0);
        } finally {
            setVisaTableLoading(false);
        }
    };
    
    if (filtersApplied && filteredData.length > 0 && !isEditingFilters.current) {
        fetchEnhancedVisaMerchants();
    }
}, [filters, filteredData, merchantPaginationEnhanced.currentPage, merchantPaginationEnhanced.pageSize, merchantSortEnhanced, merchantSearchEnhanced, filtersApplied]);
const [visaMerchantStats, setVisaMerchantStats] = useState(null);
const [monthlyTopMerchants, setMonthlyTopMerchants] = useState({});
const [selectedMerchant, setSelectedMerchant] = useState(null);
const [showMerchantDetails, setShowMerchantDetails] = useState(false);
const [chatMessages, setChatMessages] = useState([]);

// Replace your current handleNaturalLanguageSearch function with this:
const handleNaturalLanguageSearch = async () => {
  if (!searchQuery.trim()) return;
  
  // Add user message to chat
  const userMessage = {
    id: Date.now(),
    type: 'user',
    text: searchQuery,
    timestamp: new Date()
  };
  
  setChatMessages(prev => [...prev, userMessage]);
  setSearchQuery(''); // Clear input after sending
  
  try {
    setFilterLoading(true);
    setError(null);
    
    // Add loading message
    const loadingMessage = {
      id: Date.now() + 1,
      type: 'system',
      text: 'Thinking...',
      timestamp: new Date(),
      loading: true
    };
    
    setChatMessages(prev => [...prev, loadingMessage]);
    
    // Call AI service
    const aiResponse = await handleAIChat(searchQuery);
    
    // Remove loading message and add AI response
    setChatMessages(prev => {
      const withoutLoading = prev.filter(msg => !msg.loading);
      const responseMessage = {
        id: Date.now() + 2,
        type: 'system',
        text: aiResponse.message,
        timestamp: new Date(),
        data: aiResponse,
        isAI: true
      };
      return [...withoutLoading, responseMessage];
    });
    
    // Check if the AI response contains data that should trigger a data search
    if (aiResponse.query_type === 'data_query' && aiResponse.report_suggestions) {
      // You can automatically trigger data searches based on AI suggestions
      console.log('AI suggests data query:', aiResponse.report_suggestions);
      
      // Optional: Auto-trigger data search for certain query types
      if (aiResponse.report_suggestions.includes('transaction_data')) {
        // You can automatically run a data search here
        // await handleDataSearchBasedOnAI(aiResponse);
      }
    }
    
  } catch (err) {
    console.error('Error processing AI query:', err);
    
    // Remove loading message and add error
    setChatMessages(prev => {
      const withoutLoading = prev.filter(msg => !msg.loading);
      const errorMessage = {
        id: Date.now() + 2,
        type: 'error',
        text: err.message || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      return [...withoutLoading, errorMessage];
    });
    
    setError('Failed to process your query');
  } finally {
    setFilterLoading(false);
  }
};

// Add this function to handle quick actions from chat
const handleQuickAction = (action) => {
  setSearchQuery(action);
  handleNaturalLanguageSearch();
};

// Chat Message Component
// Updated Chat Message Component

// VISA Subtype Selection Popup Component
const VisaSubtypePopup = ({ open, onClose, onConfirm, loading }) => {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectAll, setSelectAll] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const visaSubtypes = [
    { value: 'VISA Purchase Completion', label: 'VISA Purchase Completion (POS/Online)', category: 'Purchase' },
    { value: 'VISA Online International Purchase', label: 'VISA Online International Purchase', category: 'Online' },
    { value: 'VISA POS International Purchase', label: 'VISA POS International Purchase', category: 'POS' },
    { value: 'VISA POS Domestic Purchase', label: 'VISA POS Domestic Purchase', category: 'POS' },
    { value: 'VISA ATM International Withdrawal', label: 'VISA ATM International Withdrawal', category: 'ATM' },
    { value: 'VISA ATM Domestic Withdrawal', label: 'VISA ATM Domestic Withdrawal', category: 'ATM' }
  ];

  React.useEffect(() => {
    if (open) {
      setSelectedTypes(visaSubtypes.map(v => v.value));
      setSelectAll(true);
    }
  }, [open]);

  const handleToggleAll = () => {
    if (selectAll) {
      setSelectedTypes([]);
      setSelectAll(false);
    } else {
      setSelectedTypes(visaSubtypes.map(v => v.value));
      setSelectAll(true);
    }
  };

  const handleToggleType = (typeValue) => {
    setSelectedTypes(prev => {
      const newSelected = prev.includes(typeValue)
        ? prev.filter(t => t !== typeValue)
        : [...prev, typeValue];
      
      setSelectAll(newSelected.length === visaSubtypes.length);
      return newSelected;
    });
  };

  const handleConfirm = () => {
    if (selectedTypes.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one VISA transaction type',
        severity: 'warning'
      });
      return;
    }
    onConfirm(selectedTypes);
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Modal 
        open={open} 
        onClose={onClose}
        sx={{
          backdropFilter: 'blur(5px)',
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }
        }}
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          bgcolor: '#2D2D42',
          borderRadius: 2,
          boxShadow: 24,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(0, 255, 136, 0.3)'
        }}>
          {/* Header */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid rgba(0, 255, 136, 0.2)',
            backgroundColor: '#3D3D5C'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ color: "#00FF88", fontWeight: 'bold' }}>
                  💳 Select VISA Transaction Types
                </Typography>
                <Typography variant="caption" sx={{ color: '#AAA' }}>
                  Choose which VISA transaction types to include in your report
                </Typography>
              </Box>
              <IconButton onClick={onClose} sx={{ color: '#FFF' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* Select All Option */}
            <Box 
              sx={{ 
                p: 1.5, 
                mb: 2, 
                backgroundColor: 'rgba(0, 255, 136, 0.1)', 
                borderRadius: 2,
                cursor: 'pointer',
                border: '1px solid rgba(0, 255, 136, 0.3)'
              }}
              onClick={handleToggleAll}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox 
                  checked={selectAll}
                  sx={{ color: '#00FF88', '&.Mui-checked': { color: '#00FF88' } }}
                />
                <Typography variant="body1" sx={{ color: '#FFF', fontWeight: 'bold' }}>
                  Select All VISA Types
                </Typography>
              </Box>
            </Box>

            {/* Individual VISA Types */}
            <Typography variant="subtitle2" sx={{ color: '#FF9800', mb: 1 }}>
              VISA Transaction Types
            </Typography>
            
            {visaSubtypes.map((subtype) => (
              <Box 
                key={subtype.value}
                sx={{ 
                  p: 1.5, 
                  mb: 1, 
                  backgroundColor: selectedTypes.includes(subtype.value) 
                    ? 'rgba(0, 255, 136, 0.15)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: selectedTypes.includes(subtype.value) 
                    ? '1px solid rgba(0, 255, 136, 0.5)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleToggleType(subtype.value)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox 
                      checked={selectedTypes.includes(subtype.value)}
                      sx={{ color: '#00FF88', '&.Mui-checked': { color: '#00FF88' } }}
                    />
                    <Box>
                      <Typography variant="body2" sx={{ color: '#FFF', fontWeight: 'bold' }}>
                        {subtype.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#AAA' }}>
                        Category: {subtype.category}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip 
                    label={subtype.category} 
                    size="small"
                    sx={{ 
                      backgroundColor: subtype.category === 'Purchase' ? '#00FF88' :
                                     subtype.category === 'Online' ? '#4A90E2' :
                                     subtype.category === 'POS' ? '#FF9800' : '#FF6384',
                      color: '#000',
                      fontSize: '0.7rem'
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>

          {/* Footer */}
          <Box sx={{ 
            p: 2, 
            borderTop: '1px solid rgba(0, 255, 136, 0.2)',
            backgroundColor: '#3D3D5C',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2
          }}>
            <Button 
              variant="outlined" 
              onClick={onClose}
              sx={{ 
                color: '#FF6384', 
                borderColor: '#FF6384',
                '&:hover': { borderColor: '#FF4757', backgroundColor: 'rgba(255, 99, 132, 0.1)' }
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleConfirm}
              disabled={selectedTypes.length === 0 || loading}
              sx={{ 
                backgroundColor: '#00FF88',
                color: '#000',
                '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.8)' },
                px: 4
              }}
            >
              {loading ? <CircularProgress size={24} /> : `Apply (${selectedTypes.length} selected)`}
            </Button>
          </Box>
        </Box>
      </Modal>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

const ChatMessage = ({ message, isLastMessage }) => {
  const messageRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (isLastMessage && messageRef.current) {
      messageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, [isLastMessage]);

  // Format AI message text with proper Markdown styling
  const formatAIMessage = (text) => {
    if (!text) return text;

    return text.split('\n').map((line, index) => {
      // Handle main headers (###)
      if (line.startsWith('### ')) {
        return (
          <Box key={index} sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mt: 2, 
            mb: 1.5,
            pb: 1,
            borderBottom: '1px solid rgba(0, 255, 136, 0.3)'
          }}>
            <Box sx={{
              width: '4px',
              height: '20px',
              backgroundColor: '#00FF88',
              borderRadius: '2px',
              mr: 1.5,
              boxShadow: '0 0 8px rgba(0, 255, 136, 0.5)'
            }} />
            <Typography variant="h6" sx={{ 
              color: '#00FF88', 
              fontWeight: '700',
              fontSize: '1.1rem',
              textShadow: '0 0 10px rgba(0, 255, 136, 0.3)'
            }}>
              {line.replace('### ', '')}
            </Typography>
          </Box>
        );
      }
      
      // Handle subheaders (####)
      if (line.startsWith('#### ')) {
        return (
          <Typography key={index} variant="subtitle1" sx={{ 
            color: '#00FF88', 
            fontWeight: '600', 
            mt: 2, 
            mb: 1.5,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Box component="span" sx={{ mr: 1, fontSize: '0.8em' }}>▸</Box>
            {line.replace('#### ', '')}
          </Typography>
        );
      }
      
      // Handle bullet points
      if (line.trim().startsWith('* ')) {
        const bulletText = line.replace('* ', '');
        return (
          <Box key={index} sx={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            mb: 1,
            pl: 1
          }}>
            <Box sx={{
              width: '6px',
              height: '6px',
              backgroundColor: '#00FF88',
              borderRadius: '50%',
              mt: 0.8,
              mr: 1.5,
              flexShrink: 0,
              boxShadow: '0 0 6px rgba(0, 255, 136, 0.5)'
            }} />
            <Typography variant="body2" sx={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              flex: 1, 
              wordBreak: 'break-word',
              lineHeight: 1.5
            }}>
              {formatBoldText(bulletText)}
            </Typography>
          </Box>
        );
      }
      
      // Handle numbered lists with bold text
      if (/^\d+\.\s/.test(line.trim())) {
        const fullLine = line.trim();
        const number = fullLine.match(/^\d+/)[0];
        const textAfterNumber = fullLine.replace(/^\d+\.\s*/, '');
        
        return (
          <Box key={index} sx={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            mb: 1.5 
          }}>
            <Box sx={{
              minWidth: '24px',
              height: '24px',
              backgroundColor: 'rgba(0, 255, 136, 0.15)',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1.5,
              flexShrink: 0
            }}>
              <Typography variant="body2" sx={{ 
                color: '#00FF88', 
                fontWeight: '600',
                fontSize: '0.75rem'
              }}>
                {number}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              flex: 1, 
              wordBreak: 'break-word',
              lineHeight: 1.5
            }}>
              {formatBoldText(textAfterNumber)}
            </Typography>
          </Box>
        );
      }
      
      // Handle empty lines as spacing
      if (line.trim() === '') {
        return <Box key={index} sx={{ height: '4px' }} />;
      }
      
      // Handle lines that contain markdown links
      if (/(\[.*?\]\(.*?\))/g.test(line)) {
        return (
          <Box key={index} sx={{ mb: 1.5 }}>
            {formatLinksLine(line)}
          </Box>
        );
      }
      
      // Handle regular text with bold formatting
      if (line.includes('**')) {
        return (
          <Typography key={index} variant="body2" sx={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            mb: 1.5, 
            lineHeight: 1.6, 
            wordBreak: 'break-word' 
          }}>
            {formatBoldText(line)}
          </Typography>
        );
      }
      
      // Regular paragraph
      return (
        <Typography key={index} variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          mb: 1.5, 
          lineHeight: 1.6, 
          wordBreak: 'break-word' 
        }}>
          {line}
        </Typography>
      );
    });
  };

  // Helper function to format bold text - FIXED VERSION
  const formatBoldText = (text) => {
    if (!text.includes('**')) return text;

    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <Box key={partIndex} component="span" sx={{ 
            fontWeight: '700', 
            color: '#00FF88',
            background: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 8px rgba(0, 255, 136, 0.3)'
          }}>
            {boldText}
          </Box>
        );
      }
      return part;
    });
  };

  // Special function to handle beautiful link cards
  const formatLinksLine = (line) => {
    const linkRegex = /(\[.*?\]\(.*?\))/g;
    const links = line.match(linkRegex) || [];
    
    if (links.length === 0) return line;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {links.map((link, linkIndex) => {
          const match = link.match(/\[(.*?)\]\((.*?)\)/);
          if (match) {
            const [, linkText, linkUrl] = match;
            return (
              <Box key={linkIndex} sx={{ display: 'flex', alignItems: 'center' }}>
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#00FF88',
                    textDecoration: 'none',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(0, 255, 136, 0.08)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 255, 136, 0.2)',
                    transition: 'all 0.3s ease',
                    wordBreak: 'break-word',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'rgba(0, 255, 136, 0.15)';
                    e.target.style.borderColor = 'rgba(0, 255, 136, 0.5)';
                    e.target.style.boxShadow = '0 4px 20px rgba(0, 255, 136, 0.2)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'rgba(0, 255, 136, 0.08)';
                    e.target.style.borderColor = 'rgba(0, 255, 136, 0.2)';
                    e.target.style.boxShadow = 'none';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <Box 
                    component="span" 
                    sx={{ 
                      mr: 2,
                      fontSize: '1.1em',
                      filter: 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.4))'
                    }}
                  >
                    📊
                  </Box>
                  <Box component="span" sx={{ flex: 1, fontWeight: '500' }}>
                    {linkText}
                  </Box>
                  <Box 
                    component="span" 
                    sx={{ 
                      ml: 1,
                      fontSize: '0.9em',
                      opacity: 0.7
                    }}
                  >
                    ↗
                  </Box>
                </a>
              </Box>
            );
          }
          return null;
        }).filter(Boolean)}
      </Box>
    );
  };

  if (message.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }} ref={isLastMessage ? messageRef : null}>
        <Box sx={{ 
          maxWidth: '70%',
          backgroundColor: 'rgba(45, 45, 66, 0.9)',
          borderRadius: '18px 18px 18px 4px',
          p: 2,
          border: '1px solid rgba(0, 255, 136, 0.2)',
          backdropFilter: 'blur(10px)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={16} sx={{ color: '#00FF88', mr: 1 }} />
            <Typography variant="body2" sx={{ color: '#00FF88' }}>
              {message.text}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  if (message.type === 'user') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }} ref={isLastMessage ? messageRef : null}>
        <Box sx={{ 
          maxWidth: '70%',
          backgroundColor: 'rgba(0, 255, 136, 0.2)',
          borderRadius: '18px 18px 4px 18px',
          p: 2,
          border: '1px solid rgba(0, 255, 136, 0.3)',
          wordBreak: 'break-word',
          backdropFilter: 'blur(10px)'
        }}>
          <Typography variant="body2" sx={{ color: '#FFFFFF' }}>
            {message.text}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mt: 0.5, textAlign: 'right' }}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (message.type === 'error') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }} ref={isLastMessage ? messageRef : null}>
        <Box sx={{ 
          maxWidth: '70%',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderRadius: '18px 18px 18px 4px',
          p: 2,
          border: '1px solid rgba(255, 99, 132, 0.3)',
          wordBreak: 'break-word',
          backdropFilter: 'blur(10px)'
        }}>
          <Typography variant="body2" sx={{ color: '#FFFFFF' }}>
            {message.text}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mt: 0.5 }}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
      </Box>
    );
  }

  // AI System message (default)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }} ref={isLastMessage ? messageRef : null}>
      <Box sx={{ 
        maxWidth: '70%',
        backgroundColor: message.isAI ? 'rgba(74, 144, 226, 0.2)' : 'rgba(45, 45, 66, 0.9)',
        borderRadius: '18px 18px 18px 4px',
        p: 2.5,
        border: message.isAI ? '1px solid rgba(74, 144, 226, 0.3)' : '1px solid rgba(0, 255, 136, 0.2)',
        overflow: 'hidden',
        wordBreak: 'break-word',
        backdropFilter: 'blur(10px)'
      }}>
        <Box sx={{ 
          color: '#FFFFFF', 
          mb: 1, 
          whiteSpace: 'pre-wrap',
          '& > *:first-of-type': { mt: 0 },
          '& > *:last-of-type': { mb: 0 }
        }}>
          {formatAIMessage(message.text)}
        </Box>
        
        {/* Quick actions for AI responses */}
        {message.isAI && message.data && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {message.data.report_suggestions && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleQuickAction('Show me transaction data')}
                sx={{ 
                  color: '#00FF88', 
                  borderColor: '#00FF88',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1.5,
                  backdropFilter: 'blur(10px)'
                }}
              >
                📊 View Data
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleQuickAction('Tell me more')}
              sx={{ 
                color: '#00FF88', 
                borderColor: '#00FF88',
                fontSize: '0.75rem',
                py: 0.5,
                px: 1.5,
                backdropFilter: 'blur(10px)'
              }}
            >
              💬 Ask Follow-up
            </Button>
          </Box>
        )}
        
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mt: 1 }}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.isAI && ' • Lazarus AI'}
        </Typography>
      </Box>
    </Box>
  );
};

// Play Around Popup Component - With Checkboxes for Selection
const PlayAroundPopup = React.memo(({ 
    open, 
    onClose, 
    searchResults,
    filters,
    onExportSummary,
    onExportCustomers,
    loading = false // Add this prop
}) => {
    const [selectedMerchants, setSelectedMerchants] = useState([]);
    const [combinedStats, setCombinedStats] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [selectAll, setSelectAll] = useState(false);
    
    // Reset selection when popup opens with new results
    useEffect(() => {
        if (open && searchResults) {
            setSelectedMerchants([]);
            setSelectAll(false);
            setCombinedStats(null);
        }
    }, [open, searchResults]);
    
    // Calculate combined stats when selection changes
    useEffect(() => {
        if (selectedMerchants.length > 0) {
            calculateCombinedStats();
        } else {
            setCombinedStats(null);
        }
    }, [selectedMerchants]);
    
    const calculateCombinedStats = async () => {
        setCalculating(true);
        try {
            const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-combined-stats', {
                merchantNames: selectedMerchants.map(m => m.MerchantName),
                dateRange: filters.dateRange,
                fromDate: filters.fromDate,
                toDate: filters.toDate,
                amountFilter: filters.amountFilter,
                amountValue: filters.amountValue
            });
            setCombinedStats(response.data);
        } catch (err) {
            console.error('Error calculating combined stats:', err);
        } finally {
            setCalculating(false);
        }
    };
    
    const handleSelectMerchant = (merchant, checked) => {
        if (checked) {
            setSelectedMerchants([...selectedMerchants, merchant]);
        } else {
            setSelectedMerchants(selectedMerchants.filter(m => m.MerchantName !== merchant.MerchantName));
        }
    };
    
    const handleSelectAll = (checked) => {
        setSelectAll(checked);
        if (checked) {
            setSelectedMerchants([...searchResults]);
        } else {
            setSelectedMerchants([]);
        }
    };
    
    const handleRemoveMerchant = (merchantName) => {
        setSelectedMerchants(selectedMerchants.filter(m => m.MerchantName !== merchantName));
    };
    
    const handleClearAll = () => {
        setSelectedMerchants([]);
        setSelectAll(false);
    };
    
    const handleExportSummary = async () => {
        if (selectedMerchants.length === 0) return;
        setExportLoading(true);
        try {
            await onExportSummary(selectedMerchants, combinedStats);
        } finally {
            setExportLoading(false);
        }
    };
    
    const handleExportCustomers = async () => {
        if (selectedMerchants.length === 0) return;
        setExportLoading(true);
        try {
            await onExportCustomers(selectedMerchants);
        } finally {
            setExportLoading(false);
        }
    };
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };
    
    return (
        <Modal 
            open={open} 
            onClose={onClose}
            sx={{
                backdropFilter: 'blur(5px)',
                '& .MuiBackdrop-root': {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)'
                }
            }}
        >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90%',
                maxWidth: '1200px',
                maxHeight: '85vh',
                bgcolor: '#2D2D42',
                borderRadius: 2,
                boxShadow: 24,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid rgba(255, 152, 0, 0.3)'
            }}>
                {/* Header */}
                <Box sx={{ 
                    p: 2, 
                    borderBottom: '1px solid rgba(255, 152, 0, 0.2)',
                    backgroundColor: '#3D3D5C',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Box>
                        <Typography variant="h6" sx={{ color: "#FF9800", fontWeight: 'bold' }}>
                            🎮 Merchant Insights Lab
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#AAA' }}>
                            {loading ? 'Loading merchants...' : 
                             `Found ${searchResults?.length || 0} merchants | 
                             ${selectedMerchants.length > 0 ? `${selectedMerchants.length} selected for analysis` : ''}`}
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} sx={{ color: '#FFF' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                
                {/* Content */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
                            <CircularProgress sx={{ color: '#FF9800' }} />
                            <Typography sx={{ color: '#AAA', ml: 2 }}>
                                Loading all merchants...
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {/* Search Results Table with Checkboxes */}
                            <Typography variant="subtitle1" sx={{ color: '#00FF88', mb: 1 }}>
                                📋 Search Results - Select Merchants to Combine
                            </Typography>
                            <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', maxHeight: 300, mb: 3 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#FF9800', width: 40 }}>
                                                <Checkbox
                                                    checked={selectAll}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    sx={{ color: '#FF9800' }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#FF9800' }}>
                                                Merchant Name
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#FF9800' }} align="right">
                                                Unique Customers
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#FF9800' }} align="right">
                                                Total Value
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#FF9800' }} align="right">
                                                Total Volume
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {searchResults?.map((merchant, idx) => (
                                            <TableRow 
                                                key={idx}
                                                sx={{ 
                                                    backgroundColor: selectedMerchants.some(m => m.MerchantName === merchant.MerchantName) 
                                                        ? 'rgba(0, 255, 136, 0.1)' 
                                                        : 'transparent'
                                                }}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedMerchants.some(m => m.MerchantName === merchant.MerchantName)}
                                                        onChange={(e) => handleSelectMerchant(merchant, e.target.checked)}
                                                        sx={{ color: '#FF9800' }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ color: '#FFF' }}>
                                                    {merchant.MerchantName}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: '#36A2EB' }}>
                                                    {merchant.UniqueCustomers?.toLocaleString() || '0'}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: '#00FF88' }}>
                                                    {formatCurrency(merchant.TotalValue || 0)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: '#FF6384' }}>
                                                    {merchant.TotalVolume?.toLocaleString() || '0'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            
                            {/* Combined Analysis Section - Shows only when merchants are selected */}
                            {selectedMerchants.length > 0 && (
                                <>
                                    <Typography variant="subtitle1" sx={{ color: '#00FF88', mb: 2, mt: 2 }}>
                                        📊 Combined Analysis ({selectedMerchants.length} Merchants)
                                    </Typography>
                                    
                                    {calculating ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                                            <CircularProgress sx={{ color: '#FF9800' }} />
                                            <Typography sx={{ color: '#AAA', ml: 2 }}>
                                                Calculating combined metrics...
                                            </Typography>
                                        </Box>
                                    ) : combinedStats ? (
                                        <>
                                            {/* Combined Metrics Cards */}
                                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                                <Grid item xs={6} sm={3}>
                                                    <Card sx={{ backgroundColor: '#3D3D5C', p: 1.5, textAlign: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: '#AAA' }}>
                                                            Combined Unique Customers
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ color: '#36A2EB', fontWeight: 'bold' }}>
                                                            {combinedStats.totalUniqueCustomers?.toLocaleString() || '0'}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#AAA' }}>
                                                            Across selected merchants
                                                        </Typography>
                                                    </Card>
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                    <Card sx={{ backgroundColor: '#3D3D5C', p: 1.5, textAlign: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: '#AAA' }}>
                                                            Combined Total Value
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ color: '#00FF88', fontWeight: 'bold' }}>
                                                            {formatCurrency(combinedStats.totalValue || 0)}
                                                        </Typography>
                                                    </Card>
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                    <Card sx={{ backgroundColor: '#3D3D5C', p: 1.5, textAlign: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: '#AAA' }}>
                                                            Combined Total Volume
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ color: '#FF6384', fontWeight: 'bold' }}>
                                                            {combinedStats.totalVolume?.toLocaleString() || '0'}
                                                        </Typography>
                                                    </Card>
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                    <Card sx={{ backgroundColor: '#3D3D5C', p: 1.5, textAlign: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: '#AAA' }}>
                                                            Combined Total Fees
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ color: '#FF9F40', fontWeight: 'bold' }}>
                                                            {formatCurrency(combinedStats.totalFees || 0)}
                                                        </Typography>
                                                    </Card>
                                                </Grid>
                                            </Grid>
                                            
                                            {/* Overlap Analysis */}
                                            {combinedStats.overlapAnalysis && combinedStats.overlapAnalysis.overlappingCustomers > 0 && (
                                                <Card sx={{ backgroundColor: '#3D3D5C', p: 2, mb: 3 }}>
                                                    <Typography variant="body2" sx={{ color: '#FFF' }}>
                                                        🔄 <strong>Customer Overlap Analysis:</strong> 
                                                        <Typography component="span" sx={{ color: '#FF9800', fontWeight: 'bold', ml: 1 }}>
                                                            {combinedStats.overlapAnalysis.overlappingCustomers?.toLocaleString() || '0'}
                                                        </Typography>
                                                        <Typography component="span" sx={{ color: '#AAA', ml: 1 }}>
                                                            customers transacted at multiple selected merchants 
                                                            ({combinedStats.overlapAnalysis.overlapPercentage || 0}% of total)
                                                        </Typography>
                                                    </Typography>
                                                </Card>
                                            )}
                                            
                                            {/* Selected Merchants List with Remove Option */}
                                            <Typography variant="subtitle2" sx={{ color: '#FF9800', mb: 1 }}>
                                                Selected Merchants (click ✖ to remove)
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                                                {selectedMerchants.map((merchant, idx) => (
                                                    <Chip
                                                        key={idx}
                                                        label={merchant.MerchantName}
                                                        onDelete={() => handleRemoveMerchant(merchant.MerchantName)}
                                                        deleteIcon={<CloseIcon />}
                                                        sx={{
                                                            backgroundColor: 'rgba(0, 255, 136, 0.2)',
                                                            color: '#FFF',
                                                            border: '1px solid rgba(0, 255, 136, 0.5)',
                                                            '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.3)' }
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </>
                                    ) : null}
                                </>
                            )}
                        </>
                    )}
                </Box>
                
                {/* Footer Actions */}
                <Box sx={{ 
                    p: 2, 
                    borderTop: '1px solid rgba(255, 152, 0, 0.2)',
                    backgroundColor: '#3D3D5C',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Button 
                        variant="outlined"
                        onClick={handleClearAll}
                        disabled={selectedMerchants.length === 0 || calculating || loading}
                        sx={{ color: '#FF6384', borderColor: '#FF6384' }}
                    >
                        Clear All
                    </Button>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                            variant="contained"
                            onClick={handleExportSummary}
                            disabled={selectedMerchants.length === 0 || calculating || exportLoading || loading}
                            startIcon={exportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                            sx={{ 
                                backgroundColor: '#00FF88', 
                                color: '#000',
                                '&:hover': { backgroundColor: '#00CC6E' }
                            }}
                        >
                            {exportLoading ? 'Exporting...' : '📊 Export Summary'}
                        </Button>
                        <Button 
                            variant="contained"
                            onClick={handleExportCustomers}
                            disabled={selectedMerchants.length === 0 || calculating || exportLoading || loading}
                            startIcon={exportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                            sx={{ 
                                backgroundColor: '#FF9800', 
                                color: '#000',
                                '&:hover': { backgroundColor: '#F57C00' }
                            }}
                        >
                            {exportLoading ? 'Exporting...' : '📋 Export Raw Transactions'}
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Modal>
    );
});

// Add display name for better debugging
PlayAroundPopup.displayName = 'PlayAroundPopup';

// Add display name for better debugging
PlayAroundPopup.displayName = 'PlayAroundPopup';


const VisaMerchantsTable = ({ 
    merchants, 
    pagination, 
    onPageChange, 
    onPageSizeChange, 
    onSortChange, 
    onSearch,
    onMerchantClick,
    loading,
    sortField,
    sortOrder,
    totalAllMerchants,
    currentSearchTerm = '',
    onPlayAround,
    hasSearchResults = false,
    totalSearchResults = 0  // Add this new prop
}) => {
    const [searchTerm, setSearchTerm] = useState(currentSearchTerm);
    const [localPageSize, setLocalPageSize] = useState(pagination.pageSize);
    
    useEffect(() => {
        setSearchTerm(currentSearchTerm);
    }, [currentSearchTerm]);
    
    const handleSort = (field) => {
        let newOrder = 'DESC';
        if (sortField === field) {
            newOrder = sortOrder === 'DESC' ? 'ASC' : 'DESC';
        }
        onSortChange(field, newOrder);
    };
    
    const getSortArrow = (field) => {
        if (sortField !== field) return '↓';
        return sortOrder === 'DESC' ? '↓' : '↑';
    };
    
    const handleSearch = () => {
        onSearch(searchTerm);
    };
    
    const handleClearSearch = () => {
        setSearchTerm('');
        onSearch('');
    };
    
    const handlePageSizeChange = (newSize) => {
        setLocalPageSize(newSize);
        onPageSizeChange(newSize);
    };
    
    const merchantPercentage = totalAllMerchants 
        ? ((pagination.totalCount / totalAllMerchants) * 100).toFixed(1)
        : 0;
    
    return (
        <Card sx={{ 
            backgroundColor: "#2D2D42", 
            mt: 3, 
            p: 2, 
            borderRadius: 2,
            border: '1px solid rgba(255, 152, 0, 0.3)'
        }}>
            {/* Header with Play Around Button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                    <Typography variant="h6" sx={{ color: "#FF9800" }}>
                        🏪 VISA Merchant Analytics
                    </Typography>
                    {/* Show search results count if there's an active search */}
                    {hasSearchResults && totalSearchResults > 0 && (
                        <Typography variant="caption" sx={{ color: '#00FF88', ml: 1 }}>
                            Found {totalSearchResults} merchant{totalSearchResults !== 1 ? 's' : ''}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {hasSearchResults && merchants.length > 0 && (
                        <Button 
                            variant="contained"
                            startIcon={<FilterAltIcon />}
                            onClick={() => onPlayAround && onPlayAround(merchants)}
                            sx={{ 
                                backgroundColor: '#FF9800',
                                color: '#000',
                                fontWeight: 'bold',
                                '&:hover': { backgroundColor: '#FF9800', opacity: 0.9 },
                                animation: 'pulse 2s infinite',
                                '@keyframes pulse': {
                                    '0%': { boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.7)' },
                                    '70%': { boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)' },
                                    '100%': { boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)' }
                                }
                            }}
                        >
                            🎮 Merchant Labs ({totalSearchResults} found)
                        </Button>
                    )}
                    <Button 
                        variant="outlined" 
                        startIcon={<DownloadIcon />}
                        sx={{ 
                            color: '#00FF88', 
                            borderColor: '#00FF88',
                            '&:hover': { borderColor: '#00FF88', backgroundColor: 'rgba(0, 255, 136, 0.1)' }
                        }}
                        onClick={exportAllVisaMerchants}
                        disabled={exportLoading}
                    >
                        {exportLoading ? 'Exporting...' : 'Export All Merchants'}
                    </Button>
                </Box>
            </Box>
            
            {/* Search and Controls */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                    size="small"
                    placeholder="Search merchants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    sx={{
                        flex: 1,
                        minWidth: 200,
                        '& .MuiInputBase-root': { color: '#FFF' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 152, 0, 0.3)' }
                    }}
                />
                <Button 
                    variant="outlined" 
                    onClick={handleSearch}
                    disabled={loading}
                    sx={{ color: '#FF9800', borderColor: '#FF9800' }}
                >
                    Search
                </Button>
                <Button 
                    variant="outlined" 
                    onClick={handleClearSearch}
                    disabled={loading}
                    sx={{ 
                        color: '#FF9800', 
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)'
                    }}
                >
                    Clear
                </Button>
                
                <TextField
                    select
                    size="small"
                    label="Show rows"
                    value={localPageSize}
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                    sx={{ width: 120, '& .MuiInputLabel-root': { color: '#AAA' } }}
                >
                    <MenuItem value={5}>Top 5</MenuItem>
                    <MenuItem value={10}>Top 10</MenuItem>
                    <MenuItem value={20}>Top 20</MenuItem>
                    <MenuItem value={50}>Top 50</MenuItem>
                    <MenuItem value={100}>Top 100</MenuItem>
                </TextField>
                
                <Typography variant="body2" sx={{ color: '#AAA', alignSelf: 'center' }}>
                    Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} - 
                    {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount}
                </Typography>
            </Box>
            
            {/* Table - Same as before without checkboxes in the main view */}
            <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', maxHeight: 500 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell 
                                sx={{ 
                                    backgroundColor: '#3D3D5C', 
                                    color: '#FF9800', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#4D4D6C' }
                                }}
                                onClick={() => handleSort('MerchantName')}
                            >
                                Merchant Name {getSortArrow('MerchantName')}
                            </TableCell>
                            <TableCell 
                                align="right" 
                                sx={{ 
                                    backgroundColor: '#3D3D5C', 
                                    color: '#FF9800', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#4D4D6C' }
                                }}
                                onClick={() => handleSort('UniqueCustomers')}
                            >
                                Unique Customers {getSortArrow('UniqueCustomers')}
                            </TableCell>
                            <TableCell 
                                align="right" 
                                sx={{ 
                                    backgroundColor: '#3D3D5C', 
                                    color: '#FF9800', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#4D4D6C' }
                                }}
                                onClick={() => handleSort('TotalVolume')}
                            >
                                Volume (Transactions) {getSortArrow('TotalVolume')}
                            </TableCell>
                            <TableCell 
                                align="right" 
                                sx={{ 
                                    backgroundColor: '#3D3D5C', 
                                    color: '#FF9800', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#4D4D6C' }
                                }}
                                onClick={() => handleSort('TotalValue')}
                            >
                                Total Value {getSortArrow('TotalValue')}
                            </TableCell>
                            <TableCell 
                                align="right" 
                                sx={{ 
                                    backgroundColor: '#3D3D5C', 
                                    color: '#FF9800', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#4D4D6C' }
                                }}
                                onClick={() => handleSort('AvgTransactionValue')}
                            >
                                Avg Transaction {getSortArrow('AvgTransactionValue')}
                            </TableCell>
                            <TableCell 
                                align="right" 
                                sx={{ 
                                    backgroundColor: '#3D3D5C', 
                                    color: '#FF9800', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#4D4D6C' }
                                }}
                                onClick={() => handleSort('TotalFees')}
                            >
                                Total Fees {getSortArrow('TotalFees')}
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                    <CircularProgress size={30} sx={{ color: '#FF9800' }} />
                                </TableCell>
                            </TableRow>
                        ) : merchants.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ color: '#AAA', py: 4 }}>
                                    No merchants found
                                </TableCell>
                            </TableRow>
                        ) : (
                            merchants.map((merchant, idx) => (
                                <TableRow 
                                    key={idx}
                                    hover
                                    onClick={() => onMerchantClick(merchant)}
                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.1)' } }}
                                >
                                    <TableCell sx={{ color: '#FFF', fontWeight: 'bold' }}>
                                        {merchant.MerchantName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: '#36A2EB' }}>
                                        {merchant.UniqueCustomers?.toLocaleString() || '0'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: '#FF6384' }}>
                                        {merchant.TotalVolume?.toLocaleString() || '0'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: '#00FF88' }}>
                                        {formatCurrency(merchant.TotalValue || 0)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: '#FF9F40' }}>
                                        {formatCurrency(merchant.AvgTransactionValue || 0)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: '#FF9F40' }}>
                                        {formatCurrency(merchant.TotalFees || 0)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
                    <IconButton 
                        onClick={() => onPageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage === 1 || loading}
                        sx={{ color: '#FF9800' }}
                    >
                        ←
                    </IconButton>
                    <Typography variant="body2" sx={{ color: '#FFF', alignSelf: 'center' }}>
                        Page {pagination.currentPage} of {pagination.totalPages}
                    </Typography>
                    <IconButton 
                        onClick={() => onPageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage === pagination.totalPages || loading}
                        sx={{ color: '#FF9800' }}
                    >
                        →
                    </IconButton>
                </Box>
            )}
            
            {/* Quick Filter Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: '#AAA', alignSelf: 'center' }}>
                    Quick filters:
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handlePageSizeChange(5)}
                    disabled={loading}
                    sx={{ color: '#FF9800', borderColor: '#FF9800' }}
                >
                    Top 5 by Volume
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handlePageSizeChange(10)}
                    disabled={loading}
                    sx={{ color: '#FF9800', borderColor: '#FF9800' }}
                >
                    Top 10 by Volume
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        handleSort('TotalVolume');
                    }}
                    disabled={loading}
                    sx={{ color: '#FF9800', borderColor: '#FF9800' }}
                >
                    Sort by Volume {sortField === 'TotalVolume' && (sortOrder === 'DESC' ? '↓' : '↑')}
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        handleSort('TotalValue');
                    }}
                    disabled={loading}
                    sx={{ color: '#FF9800', borderColor: '#FF9800' }}
                >
                    Sort by Value {sortField === 'TotalValue' && (sortOrder === 'DESC' ? '↓' : '↑')}
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        handleSort('UniqueCustomers');
                    }}
                    disabled={loading}
                    sx={{ color: '#FF9800', borderColor: '#FF9800' }}
                >
                    Sort by Customers {sortField === 'UniqueCustomers' && (sortOrder === 'DESC' ? '↓' : '↑')}
                </Button>
            </Box>
        </Card>
    );
};

useEffect(() => {
    // On initial load, don't fetch VISA data
    if (filteredData.length === 0) {
        setFiltersApplied(false);
        setVisaMerchantsEnhanced([]);
        setVisaOverallStats(null);
        setShowVisaMerchantsEnhanced(false);
        setVisaTableLoading(false);
    }
}, []);
// AI Chat Service
const handleAIChat = async (query, conversationId = "string") => {
  const dbInfo = await getUserInfo();
  const dbother = await getDBInfo();
  console.log('User Info for AI Chat:',  dbother);
  // console.log('DB Info for AI Chat:',  dbother.user.username);  
  try {
    const response = await axios.post('http://172.16.3.21:3003/api/transtype/Ai', {
      query: query,
  customer_email: dbother[0]?.email || dbInfo.data?.email || `${dbother.user.username}@omari.co.zw`|| 'praisec@oldmutual.co.zw',
  customer_id: dbother[0]?.username ||  dbInfo.data?.employeeID || dbother.user?.username || 'praisec',
  conversation_id: conversationId,
  context: {}
    });

    return response.data;
  } catch (error) {
    console.error('AI Chat Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to get AI response');
  }
};

const applyFilters = async () => {
  if (!validateDateRange()) {
    return;
  }
  
  // Check if VISA is selected
  const hasVisaSelected = filters.transactionTypes.includes('VISA') || 
                          filters.transactionTypes.includes('All') ||
                          filters.transactionTypes.length === 0;
  
  if (hasVisaSelected) {
    // Show VISA subtype selection popup
    setVisaSubtypePopup({
      open: true,
      selectedTypes: [],
      pendingFilters: { ...filters }
    });
  } else {
    // Clear visaSubTypes when VISA is not selected
    const updatedFilters = { 
      ...filters, 
      visaSubTypes: []  // Reset VISA subtypes
    };
    setFilters(updatedFilters);
    
    // No VISA selected - proceed with amount filter popup
    setFilterConfirmation({
      open: true,
      filters: updatedFilters
    });
  }
};

const handleVisaSubtypeConfirm = async (selectedVisaTypes) => {
  // Store the selected types in a temporary variable
  const selectedTypes = [...selectedVisaTypes];
  
  setVisaSubtypePopup({ open: false, selectedTypes: [], pendingFilters: null });
  
  // Add the selected VISA types to the filters
  const updatedFilters = {
    ...filters,
    visaSubTypes: selectedTypes
  };
  
  // Update the filters state
  setFilters(updatedFilters);
  
  // Now proceed to amount filter popup with the updated filters
  setFilterConfirmation({
    open: true,
    filters: updatedFilters
  });
};

const executeFilterApplication = async (filterData) => {
  try {
    setFilterLoading(true);
    setError(null);
    
    // Reset all VISA merchant states
    setVisaMerchantsEnhanced([]);
    setVisaOverallStats(null);
    setShowVisaMerchantsEnhanced(false);
    setVisaTableLoading(true);
    
    setMerchantPaginationEnhanced({
      currentPage: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0
    });
    
    setMerchantSortEnhanced({ field: 'TotalVolume', order: 'DESC' });
    setMerchantSearchEnhanced('');
    
    setMerchantDetails({
      open: false,
      merchant: null,
      transactions: [],
      summary: {},
      loading: false,
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0
      }
    });
    
    // If VISA is not in transactionTypes, ensure visaSubTypes is empty
    const hasVisa = filterData.transactionTypes.includes('VISA') || 
                    filterData.transactionTypes.includes('All') ||
                    filterData.transactionTypes.length === 0;
    
    const finalFilterData = { 
      ...filterData,
      visaSubTypes: hasVisa ? (filterData.visaSubTypes || []) : []  // Reset if no VISA
    };
    
    setFilters(finalFilterData);
    
    // If 'VISA' is in transactionTypes, replace with actual subtypes
    let transactionTypesForBackend = finalFilterData.transactionTypes;
    if (finalFilterData.transactionTypes.includes('VISA')) {
      transactionTypesForBackend = [
        ...finalFilterData.transactionTypes.filter(t => t !== 'VISA'),
        ...(finalFilterData.visaSubTypes || [])
      ];
    }
    
    const apiFilterData = { 
      ...finalFilterData,
      transactionTypes: transactionTypesForBackend.includes('All') || transactionTypesForBackend.length === 0 
        ? 'All' 
        : transactionTypesForBackend,
      terminalType: finalFilterData.terminalType || 'All',
      visaSubTypes: finalFilterData.visaSubTypes || []
    };
    
    if (finalFilterData.dateRange !== 'custom') {
      apiFilterData.fromDate = '';
      apiFilterData.toDate = '';
    }
    
    if (apiFilterData.amountFilter === 'none') {
      apiFilterData.amountFilter = '';
      apiFilterData.amountValue = '';
    }
    
    const response = await axios.post('http://172.16.3.21:3003/api/transtype/filtered-data', apiFilterData);
    
    const processedData = response.data.dailyData.map(item => ({
      ...item,
      TotalVolume: typeof item.TotalVolume === 'string' 
        ? parseFloat(item.TotalVolume) || 0 
        : item.TotalVolume
    }));
    
    const totalUniqueUsers = response.data.totalUniqueUsers || [];
    const monthlyComboUsers = response.data.monthlyComboUsers || {};
    const totalComboUsers = response.data.totalComboUsers || 0;
    const monthlyUniqueUsers = response.data.monthlyUniqueUsers || [];
    
    setFilteredData(processedData);
    setTotalUniqueUsers(totalUniqueUsers);
    setMonthlyComboUsers(monthlyComboUsers);
    setTotalComboUsers(totalComboUsers);
    setMonthlyUniqueUsers(monthlyUniqueUsers);
    
    setFiltersApplied(true);
    isEditingFilters.current = false;
    
    setSnackbar({
      open: true,
      message: `Found ${processedData.length} daily records with ${totalUniqueUsers.reduce((sum, item) => sum + item.TotalUniqueUsers, 0)} total unique users`,
      severity: 'success'
    });

    if (processedData.length === 0) {
      setIsBackdropOpen(true);
    } else {
      setIsBackdropOpen(false);
      setSearchMode('text');
      setShowChatInterface(false);
    }

  } catch (err) {
    console.error('Error applying filters:', err);
    setError('Failed to apply filters');
    setSnackbar({
      open: true,
      message: 'Error applying filters',
      severity: 'error'
    });
    setVisaTableLoading(false);
    isEditingFilters.current = false;
  } finally {
    setFilterLoading(false);
    setFilterConfirmation({ open: false, filters: null });
  }
};

// Add this new state for merchant details
const [merchantDetails, setMerchantDetails] = useState({
    open: false,
    merchant: null,
    transactions: [],
    summary: {},
    loading: false,
    pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0
    }
});

const fetchMerchantDetails = async (merchant, page = 1, pageSize = 20) => {
    setMerchantDetails(prev => ({ 
        ...prev, 
        loading: true,
        open: true,
        merchant: merchant
    }));
    
    try {
        const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-merchant-details', {
            merchantName: merchant.MerchantName,
            dateRange: filters.dateRange,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            amountFilter: filters.amountFilter,
            amountValue: filters.amountValue,
            page: page,
            pageSize: pageSize,
            terminalType: filters.terminalType || 'All',
            visaSubTypes: filters.visaSubTypes  // ← Add this line
        });
        
        setMerchantDetails(prev => ({
            ...prev,
            transactions: response.data.transactions,
            summary: response.data.summary,
            loading: false,
            pagination: response.data.pagination
        }));
    } catch (err) {
        console.error('Error fetching merchant details:', err);
        setSnackbar({
            open: true,
            message: 'Error loading merchant details',
            severity: 'error'
        });
        setMerchantDetails(prev => ({ ...prev, loading: false, open: false }));
    }
};

// Close merchant details modal
const closeMerchantDetails = () => {
    setMerchantDetails({
        open: false,
        merchant: null,
        transactions: [],
        summary: {},
        loading: false,
        pagination: {
            currentPage: 1,
            pageSize: 20,
            totalCount: 0,
            totalPages: 0
        }
    });
};

// Handle pagination change in merchant details
const handleMerchantDetailsPageChange = (newPage) => {
    fetchMerchantDetails(merchantDetails.merchant, newPage, merchantDetails.pagination.pageSize);
};

// Handle page size change in merchant details
const handleMerchantDetailsPageSizeChange = (newSize) => {
    fetchMerchantDetails(merchantDetails.merchant, 1, newSize);
};

// Update the MerchantDetailsModal component to prevent page scroll
const MerchantDetailsModal = ({ open, onClose, merchant, transactions, summary, loading, pagination, onPageChange, onPageSizeChange, filters }) => {
    const [pageSize, setPageSize] = useState(pagination?.pageSize || 20);
    const [page, setPage] = useState(pagination?.currentPage || 1);
    const [exportLoading, setExportLoading] = useState(false);
    
    useEffect(() => {
        if (pagination) {
            setPage(pagination.currentPage);
            setPageSize(pagination.pageSize);
        }
    }, [pagination]);
    
    const handlePageChange = (newPage) => {
        setPage(newPage);
        onPageChange(newPage);
    };
    
    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        onPageSizeChange(newSize);
    };

   // Update the handleExport function in your MerchantDetailsModal component
const handleExport = async () => {
    setExportLoading(true);
    try {
        const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-merchant-details-export', {
            merchantName: merchant.MerchantName,
            dateRange: filters.dateRange,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            amountFilter: filters.amountFilter,
            amountValue: filters.amountValue,
            visaSubTypes: filters.visaSubTypes  // ← Add this line
        });
        const exportData = response.data;
        const totalTransactions = exportData.transactions.length;
        
        // Generate date range string for filename
        let dateRangeStr = '';
        let dateRangeDisplay = '';
        
        if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
            const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            dateRangeStr = ` (${from} to ${to})`;
            dateRangeDisplay = `${from} to ${to}`;
        } else if (filters.dateRange !== 'custom') {
            const now = new Date();
            let rangeText = '';
            
            switch (filters.dateRange) {
                case 'day':
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    dateRangeDisplay = rangeText;
                    break;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    rangeText = weekStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    dateRangeDisplay = `Week of ${rangeText}`;
                    break;
                case 'month':
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    dateRangeDisplay = rangeText;
                    break;
                default:
                    rangeText = 'All Time';
                    dateRangeDisplay = 'All Time';
            }
            
            dateRangeStr = ` (${rangeText})`;
        }
        
        // Prepare worksheet data for ALL transactions
        const worksheetData = exportData.transactions.map(txn => ({
            'Account ID': txn.AccountId,
            'Transaction Date': new Date(txn.TransactionDate).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            'Transaction Amount': txn.TransactionAmount,
            'Net Fee': txn.NetFee || 0,
            'Tax Fee': txn.TaxFee || 0,
            'Merchant Name': txn.MerchantName
        }));
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Sheet 1: Summary
        const summaryData = [
            ['VISA Merchant Transaction Report', ''],
            ['Merchant Name:', exportData.merchantName],
            ['Date Range:', dateRangeDisplay],
            ['Generated:', new Date().toLocaleString()],
            ['Total Transactions:', totalTransactions.toLocaleString()],
            ['', ''],
            ['Summary Statistics', ''],
            ['Unique Customers:', exportData.summary.UniqueCustomers?.toLocaleString() || '0'],
            ['Total Volume:', exportData.summary.TotalVolume?.toLocaleString() || '0'],
            ['Total Value:', formatCurrency(exportData.summary.TotalValue || 0)],
            ['Average Transaction Value:', formatCurrency(exportData.summary.AvgTransactionValue || 0)],
            ['Minimum Transaction Value:', formatCurrency(exportData.summary.MinTransactionValue || 0)],
            ['Maximum Transaction Value:', formatCurrency(exportData.summary.MaxTransactionValue || 0)],
            ['Total Fees:', formatCurrency(exportData.summary.TotalFees || 0)],
            ['', ''],
            ['Transaction Details (Total: ' + totalTransactions.toLocaleString() + ' transactions)', '']
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        
        // Sheet 2: All Transactions
        const transactionsSheet = XLSX.utils.json_to_sheet(worksheetData);
        
        // Set column widths for transactions sheet
        transactionsSheet['!cols'] = [
            { wch: 20 }, // Account ID
            { wch: 25 }, // Transaction Date
            { wch: 15 }, // Transaction Amount
            { wch: 12 }, // Net Fee
            { wch: 12 }, // Tax Fee
            { wch: 40 }  // Merchant Name
        ];
        
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'All Transactions');
        
        // Create filename with merchant name and date range
        const safeMerchantName = exportData.merchantName.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        XLSX.writeFile(workbook, `${safeMerchantName}${dateRangeStr}.xlsx`);
        
        setExportLoading(false);
        setSnackbar({
            open: true,
            message: `✅ Exported ALL ${totalTransactions.toLocaleString()} transactions for ${exportData.merchantName}${dateRangeStr}`,
            severity: 'success'
        });
        
    } catch (err) {
        console.error('Error exporting merchant details:', err);
        setExportLoading(false);
        setSnackbar({
            open: true,
            message: 'Error exporting merchant details',
            severity: 'error'
        });
    }
};
    
    if (!merchant) return null;
    
    return (
        <Modal 
            open={open} 
            onClose={onClose}
            sx={{
                backdropFilter: 'blur(5px)',
                // Prevent body scroll when modal is open
                '& .MuiBackdrop-root': {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)'
                }
            }}
            // Disable scroll lock to prevent page jumping
            disableScrollLock={false}
            // Keep modal centered
            keepMounted={false}
        >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90%',
                maxWidth: '1200px',
                height: '80vh',
                bgcolor: '#2D2D42',
                borderRadius: 2,
                boxShadow: 24,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid rgba(0, 255, 136, 0.3)'
            }}>
                {/* Header with Export Button */}
                <Box sx={{ 
                    p: 2, 
                    borderBottom: '1px solid rgba(0, 255, 136, 0.2)',
                    backgroundColor: '#3D3D5C'
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ color: "#FF9800", fontWeight: 'bold' }}>
                            🏪 {merchant.MerchantName}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button 
                                variant="outlined" 
                                startIcon={<DownloadIcon />}
                                onClick={handleExport}
                                disabled={exportLoading || loading}
                                sx={{ 
                                    color: '#00FF88', 
                                    borderColor: '#00FF88',
                                    '&:hover': { borderColor: '#00FF88', backgroundColor: 'rgba(0, 255, 136, 0.1)' }
                                }}
                            >
                                {exportLoading ? <CircularProgress size={20} /> : 'Export to Excel'}
                            </Button>
                            <IconButton onClick={onClose} sx={{ color: '#FFF' }}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </Box>
                    
                    {/* Summary Stats - Show loading skeletons or actual data */}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={6} sm={2}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#AAA' }}>Unique Customers</Typography>
                                <Typography variant="h6" sx={{ color: '#36A2EB' }}>
                                    {loading ? '---' : (summary.UniqueCustomers?.toLocaleString() || '0')}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#AAA' }}>Total Volume</Typography>
                                <Typography variant="h6" sx={{ color: '#FF6384' }}>
                                    {loading ? '---' : (summary.TotalVolume?.toLocaleString() || '0')}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#AAA' }}>Total Value</Typography>
                                <Typography variant="h6" sx={{ color: '#00FF88' }}>
                                    {loading ? '---' : formatCurrency(summary.TotalValue || 0)}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#AAA' }}>Avg Transaction</Typography>
                                <Typography variant="h6" sx={{ color: '#FF9F40' }}>
                                    {loading ? '---' : formatCurrency(summary.AvgTransactionValue || 0)}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#AAA' }}>Total Fees</Typography>
                                <Typography variant="h6" sx={{ color: '#FF9F40' }}>
                                    {loading ? '---' : formatCurrency(summary.TotalFees || 0)}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
                
                {/* Transactions Table with Loading State */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2, position: 'relative' }}>
                    {loading && (
                        <Box sx={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20,
                            borderRadius: 2
                        }}>
                            <Box sx={{ 
                                textAlign: 'center',
                                backgroundColor: 'rgba(45, 45, 66, 0.95)',
                                padding: 3,
                                borderRadius: 3,
                                border: '2px solid rgba(0, 255, 136, 0.3)',
                                boxShadow: '0 0 30px rgba(0, 255, 136, 0.2)',
                                minWidth: 280
                            }}>
                                <CircularProgress size={40} sx={{ color: '#00FF88', mb: 1.5 }} />
                                <Typography variant="body1" sx={{ color: '#00FF88', fontWeight: 'bold', mb: 1 }}>
                                    Loading Transactions
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#AAA' }}>
                                    Fetching data for {merchant?.MerchantName}...
                                </Typography>
                            </Box>
                        </Box>
                    )}
                    
                    {!loading && transactions.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <Typography variant="body1" sx={{ color: '#AAA' }}>
                                No transactions found for this merchant
                            </Typography>
                        </Box>
                    ) : !loading && (
                        <>
                            <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', maxHeight: 'calc(100% - 80px)' }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold' }}>
                                                Account ID
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold' }}>
                                                Transaction Date
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold' }} align="right">
                                                Amount
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold' }} align="right">
                                                Net Fee
                                            </TableCell>
                                            <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold' }} align="right">
                                                Tax Fee
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {transactions.map((txn, idx) => (
                                            <TableRow key={idx} hover>
                                                <TableCell sx={{ color: '#FFF', fontFamily: 'monospace' }}>
                                                    {txn.AccountId}
                                                </TableCell>
                                                <TableCell sx={{ color: '#FFF' }}>
                                                    {new Date(txn.TransactionDate).toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: '#00FF88', fontWeight: 'bold' }}>
                                                    {formatCurrency(txn.TransactionAmount)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: '#FF9F40' }}>
                                                    {formatCurrency(txn.NetFee || 0)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: '#FF9F40' }}>
                                                    {formatCurrency(txn.TaxFee || 0)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            
                            {/* Pagination Controls */}
                            {pagination && pagination.totalPages > 1 && (
                                <Box sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    mt: 2,
                                    pt: 2,
                                    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                                }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>
                                        Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} - 
                                        {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} transactions
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <TextField
                                            select
                                            size="small"
                                            value={pageSize}
                                            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                                            sx={{ 
                                                width: '80px',
                                                '& .MuiInputBase-root': { color: '#FFF' },
                                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' }
                                            }}
                                        >
                                            {[10, 20, 50, 100].map(option => (
                                                <MenuItem key={option} value={option}>{option}</MenuItem>
                                            ))}
                                        </TextField>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <IconButton 
                                                onClick={() => handlePageChange(page - 1)}
                                                disabled={page === 1}
                                                sx={{ color: '#00FF88' }}
                                            >
                                                ←
                                            </IconButton>
                                            <Typography variant="body2" sx={{ color: '#FFF', alignSelf: 'center' }}>
                                                Page {page} of {pagination.totalPages}
                                            </Typography>
                                            <IconButton 
                                                onClick={() => handlePageChange(page + 1)}
                                                disabled={page === pagination.totalPages}
                                                sx={{ color: '#00FF88' }}
                                            >
                                                →
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </Box>
        </Modal>
    );
};



const allTransactionTypes = useMemo(() => {
    const types = new Set();
    filteredData.forEach(item => types.add(item.TransactionType));
    return Array.from(types).sort();
  }, [filteredData]);

const comprehensiveData = useMemo(() => {
  if (filteredData.length === 0) return [];
  
  // Group by month and transaction type
  const monthlyData = {};
  
  // Create a map of monthly unique users by transaction type
  const monthlyUUMap = {};
  monthlyUniqueUsers.forEach(item => {
    if (!monthlyUUMap[item.MonthYear]) {
      monthlyUUMap[item.MonthYear] = {};
    }
    monthlyUUMap[item.MonthYear][item.TransactionType] = item.MonthlyUniqueUsers;
  });
  
  filteredData.forEach(item => {
    const date = new Date(item.Date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const transactionType = item.TransactionType;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthName,
        monthKey: monthKey,
        transactionTypes: {},
        comboUsers: monthlyComboUsers[monthKey] || 0 // Add monthly combo users
      };
    }
    
    // Initialize transaction type if it doesn't exist
    if (!monthlyData[monthKey].transactionTypes[transactionType]) {
      monthlyData[monthKey].transactionTypes[transactionType] = {
        uniqueUsers: 0,
        volume: 0,
        value: 0
      };
    }
    
    // Add the aggregated values
    const volume = typeof item.TotalVolume === 'number' ? item.TotalVolume : parseFloat(item.TotalVolume) || 0;
    
    monthlyData[monthKey].transactionTypes[transactionType].uniqueUsers += item.UniqueCustomers;
    monthlyData[monthKey].transactionTypes[transactionType].volume += volume;
    monthlyData[monthKey].transactionTypes[transactionType].value += item.TotalValue;
  });
  
  // Calculate averages and convert to array
  return Object.values(monthlyData)
    .map(item => ({
      ...item,
      transactionTypes: Object.fromEntries(
        Object.entries(item.transactionTypes).map(([type, data]) => [
          type,
          {
            uniqueUsers: monthlyUUMap[item.monthKey] && monthlyUUMap[item.monthKey][type] 
              ? monthlyUUMap[item.monthKey][type] 
              : data.uniqueUsers,
            volume: data.volume,
            value: data.value,
            avgValue: data.volume > 0 ? data.value / data.volume : 0
          }
        ])
      )
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}, [filteredData, monthlyUniqueUsers, monthlyComboUsers]);

// Add these handler functions in your Dashboard component

// Replace your current handlePlayAround function with this one
const handlePlayAround = async (currentPageMerchants) => {
    setAnalysisLoading(true);
    setShowPlayAroundPopup(true);
    
    try {
        const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-merchants-enhanced', {
            dateRange: filters.dateRange,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            amountFilter: filters.amountFilter,
            amountValue: filters.amountValue,
            page: 1,
            pageSize: 100000,
            sortBy: merchantSortEnhanced.field,
            sortOrder: merchantSortEnhanced.order,
            searchTerm: merchantSearchEnhanced,
            terminalType: filters.terminalType || 'All'  // Add this line
        });
        
        const allMerchants = response.data.merchants || [];
        setSearchResults(allMerchants);
        setShowPlayAroundPopup(true);
        
        setSnackbar({
            open: true,
            message: `Loaded ${allMerchants.length} merchants for analysis`,
            severity: 'success'
        });
    } catch (err) {
        console.error('Error fetching all merchants for analysis:', err);
        setSearchResults(currentPageMerchants);
        setShowPlayAroundPopup(true);
    } finally {
        setAnalysisLoading(false);
    }
};
// Export combined summary for selected merchants - REMOVE the exportLoading state entirely
const handleExportCombinedSummary = useCallback(async (selectedMerchants, combinedStats) => {
    // This function should NOT modify any state that affects the popup
    try {
        // Generate date range string
        let dateRangeStr = '';
        let dateRangeDisplay = '';
        
        if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
            const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            dateRangeStr = ` (${from} to ${to})`;
            dateRangeDisplay = `${from} to ${to}`;
        } else if (filters.dateRange !== 'custom') {
            const now = new Date();
            let rangeText = '';
            switch (filters.dateRange) {
                case 'day': 
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    dateRangeDisplay = rangeText;
                    break;
                case 'week': 
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    rangeText = weekStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    dateRangeDisplay = `Week of ${rangeText}`;
                    break;
                case 'month': 
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    dateRangeDisplay = rangeText;
                    break;
                default: 
                    rangeText = 'All Time';
                    dateRangeDisplay = 'All Time';
            }
            dateRangeStr = ` (${rangeText})`;
        }
        
        // Prepare summary data
        const summaryData = [
            ['MERCHANT COMBINED ANALYSIS REPORT', ''],
            ['Generated:', new Date().toLocaleString()],
            ['Date Range:', dateRangeDisplay],
            ['', ''],
            ['SELECTED MERCHANTS (' + selectedMerchants.length + ')', ''],
            ...selectedMerchants.map((m, idx) => [`${idx + 1}. ${m.MerchantName}`, '']),
            ['', ''],
            ['COMBINED METRICS', ''],
            ['Total Unique Customers:', combinedStats?.totalUniqueCustomers?.toLocaleString() || '0'],
            ['Total Value:', formatCurrency(combinedStats?.totalValue || 0)],
            ['Total Volume:', combinedStats?.totalVolume?.toLocaleString() || '0'],
            ['Total Fees:', formatCurrency(combinedStats?.totalFees || 0)],
            ['', ''],
            ['OVERLAP ANALYSIS', ''],
            ['Customers at Multiple Merchants:', combinedStats?.overlapAnalysis?.overlappingCustomers?.toLocaleString() || '0'],
            ['Overlap Percentage:', `${combinedStats?.overlapAnalysis?.overlapPercentage || 0}%`]
        ];
        
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths
        worksheet['!cols'] = [{ wch: 40 }, { wch: 30 }];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Combined Analysis');
        const safeMerchantNames = selectedMerchants.slice(0, 3).map(m => m.MerchantName.substring(0, 20)).join('_');
        XLSX.writeFile(workbook, `merchant-combined-analysis_${safeMerchantNames}${dateRangeStr}.xlsx`);
        
        setSnackbar({
            open: true,
            message: `✅ Exported combined analysis for ${selectedMerchants.length} merchants`,
            severity: 'success'
        });
    } catch (err) {
        console.error('Error exporting combined summary:', err);
        setSnackbar({
            open: true,
            message: 'Error exporting summary',
            severity: 'error'
        });
    }
    // No state changes that would affect the popup - NO setExportLoading
}, [filters.dateRange, filters.fromDate, filters.toDate, formatCurrency, setSnackbar]);

// Export detailed customer data for selected merchants (raw transaction data)
const handleExportSelectedCustomers = useCallback(async (selectedMerchants) => {
    // This function should NOT modify any state that affects the popup
    try {
        // Generate date range string for filename
        let dateRangeStr = '';
        let dateRangeDisplay = '';
        
        if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
            const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).replace(/\//g, '-');
            
            dateRangeStr = ` (${from} to ${to})`;
            dateRangeDisplay = `${from} to ${to}`;
        } else if (filters.dateRange !== 'custom') {
            const now = new Date();
            let rangeText = '';
            
            switch (filters.dateRange) {
                case 'day':
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    dateRangeDisplay = rangeText;
                    break;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    rangeText = weekStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                    dateRangeDisplay = `Week of ${rangeText}`;
                    break;
                case 'month':
                    rangeText = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    dateRangeDisplay = rangeText;
                    break;
                default:
                    rangeText = 'All Time';
                    dateRangeDisplay = 'All Time';
            }
            
            dateRangeStr = ` (${rangeText})`;
        }
        
        // Call API to get all transactions for selected merchants
        const response = await axios.post('http://172.16.3.21:3003/api/transtype/visa-export-selected-customers', {
            merchantNames: selectedMerchants.map(m => m.MerchantName),
            dateRange: filters.dateRange,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            amountFilter: filters.amountFilter,
            amountValue: filters.amountValue,
            exportType: 'detailed'
        });
        
        const transactions = response.data.transactions || [];
        const totalUniqueCustomers = response.data.totalUniqueCustomers || 0;
        const totalValue = response.data.totalValue || 0;
        const totalVolume = response.data.totalVolume || 0;
        
        // Prepare raw transaction data for Excel
        const transactionData = transactions.map(txn => ({
            'Account ID': txn.AccountId,
            'Merchant Name': txn.MerchantName,
            'Transaction Date': new Date(txn.TransactionDate).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            'Transaction Amount': txn.TransactionAmount,
            'Net Fee': txn.NetFee || 0,
            'Tax Fee': txn.TaxFee || 0
        }));
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Sheet 1: Summary with selected merchants info
        const summaryData = [
            ['SELECTED MERCHANTS RAW TRANSACTION EXPORT', ''],
            ['Generated:', new Date().toLocaleString()],
            ['Date Range:', dateRangeDisplay],
            ['', ''],
            ['Selected Merchants (' + selectedMerchants.length + ')', ''],
            ...selectedMerchants.map((m, idx) => [`${idx + 1}. ${m.MerchantName}`, '']),
            ['', ''],
            ['Summary Statistics', ''],
            ['Total Transactions:', transactions.length.toLocaleString()],
            ['Total Unique Customers:', totalUniqueCustomers.toLocaleString()],
            ['Total Volume:', totalVolume.toLocaleString()],
            ['Total Value:', formatCurrency(totalValue || 0)],
            ['', ''],
            ['RAW TRANSACTION DETAILS (Total: ' + transactions.length.toLocaleString() + ' transactions)', '']
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        
        // Sheet 2: All Raw Transactions
        const transactionsSheet = XLSX.utils.json_to_sheet(transactionData);
        
        // Set column widths
        transactionsSheet['!cols'] = [
            { wch: 20 }, // Account ID
            { wch: 40 }, // Merchant Name
            { wch: 25 }, // Transaction Date
            { wch: 15 }, // Transaction Amount
            { wch: 12 }, // Net Fee
            { wch: 12 }  // Tax Fee
        ];
        
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Raw Transactions');
        
        // Sheet 3: Merchant Breakdown
        const merchantBreakdown = selectedMerchants.map(m => ({
            'Merchant Name': m.MerchantName,
            'Unique Customers': m.UniqueCustomers?.toLocaleString() || '0',
            'Total Volume': m.TotalVolume?.toLocaleString() || '0',
            'Total Value': formatCurrency(m.TotalValue || 0),
            'Avg Transaction': formatCurrency(m.AvgTransactionValue || 0)
        }));
        const breakdownSheet = XLSX.utils.json_to_sheet(merchantBreakdown);
        XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Merchant Breakdown');
        
        // Create filename
        const merchantNamesStr = selectedMerchants.length > 3 
            ? `${selectedMerchants.slice(0, 3).map(m => m.MerchantName.substring(0, 20)).join('_')}_and_${selectedMerchants.length - 3}_more`
            : selectedMerchants.map(m => m.MerchantName.substring(0, 20)).join('_');
        
        const safeMerchantNames = merchantNamesStr.replace(/[^a-z0-9]/gi, '_').substring(0, 100);
        const fileName = `${safeMerchantNames}_raw_transactions${dateRangeStr}.xlsx`;
        
        XLSX.writeFile(workbook, fileName);
        
        setSnackbar({
            open: true,
            message: `✅ Exported ${transactions.length.toLocaleString()} raw transactions for ${selectedMerchants.length} merchants${dateRangeStr}`,
            severity: 'success'
        });
    } catch (err) {
        console.error('Error exporting customer details:', err);
        setSnackbar({
            open: true,
            message: 'Error exporting raw transaction data',
            severity: 'error'
        });
    }
    // No state changes that would affect the popup - NO setExportLoading
}, [filters, formatCurrency, setSnackbar]);
// Enhanced Comprehensive Table Component with Total Combo Display
const ComprehensiveTable = ({ data, transactionTypes, totalComboUsers, monthlyTopMerchants }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedMonth, setExpandedMonth] = useState(null);
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - data.length) : 0;
  
  const getTotalUniqueUsersForType = (monthData, transactionType) => {
    const typeData = monthData.transactionTypes[transactionType];
    return typeData ? typeData.uniqueUsers : 0;
  };

  // Check if VISA transactions exist
  const hasVisaTransactions = useMemo(() => {
    return transactionTypes.includes('VISA Purchase Completion');
  }, [transactionTypes]);


  
  return (
    <Box sx={{ 
      width: '100%', 
      overflow: 'hidden',
      borderRadius: '4px',
      border: '1px solid rgba(0, 255, 136, 0.2)'
    }}>
      
      <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', maxHeight: 600, width: '100%' }}>
        <Table stickyHeader size="small" sx={{ minWidth: 'max-content' }}>
          <TableHead>
            <TableRow>
              <TableCell 
                rowSpan={2} 
                sx={{ 
                  backgroundColor: '#3D3D5C', 
                  color: '#00FF88', 
                  fontWeight: 'bold', 
                  minWidth: 120,
                  borderRight: '1px solid #555',
                  position: 'sticky',
                  left: 0,
                  zIndex: 10
                }}
              >
                Date
              </TableCell>
              {transactionTypes.map(type => (
                <TableCell 
                  key={type} 
                  colSpan={4} 
                  align="center"
                  sx={{ 
                    backgroundColor: '#3D3D5C', 
                    color: '#00FF88', 
                    fontWeight: 'bold',
                    borderRight: '1px solid #555'
                  }}
                >
                  {type}
                </TableCell>
              ))}
              <TableCell 
                rowSpan={2}
                align="center"
                sx={{ 
                  backgroundColor: '#3D3D5C', 
                  color: '#FF9800', 
                  fontWeight: 'bold', 
                  minWidth: 140,
                  borderRight: '1px solid #555',
                  position: 'sticky',
                  right: 0,
                  zIndex: 10
                }}
              >
                Combo Users
                <Box sx={{ fontSize: '0.8em', color: '#4FC3F7', mt: 0.5 }}>
                  Total: {totalComboUsers.toLocaleString()}
                </Box>
              </TableCell>
            </TableRow>
            <TableRow>
              {transactionTypes.flatMap(type => [
                <TableCell key={`${type}-total-users`} sx={{ backgroundColor: '#3D3D5C', color: '#4FC3F7', fontWeight: 'bold', borderRight: 'none' }}>
                  Monthly UU
                </TableCell>,
                <TableCell key={`${type}-volume`} sx={{ backgroundColor: '#3D3D5C', color: '#FF6384', fontWeight: 'bold', borderRight: 'none' }}>
                  Volume
                </TableCell>,
                <TableCell key={`${type}-value`} sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', borderRight: 'none' }}>
                  Value
                </TableCell>,
                <TableCell key={`${type}-avg`} sx={{ backgroundColor: '#3D3D5C', color: '#FF9F40', fontWeight: 'bold', borderRight: 'none' }}>
                  Avg. Value
                </TableCell>
              ])}
            </TableRow>
          </TableHead>
          <TableBody>
            {(rowsPerPage > 0 ? data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : data)
            .map((row, index) => {
              const monthMerchants = monthlyTopMerchants[row.monthKey];
              return (
                <React.Fragment key={index}>
                  <TableRow>
                    <TableCell sx={{ color: '#FFF', fontWeight: 'bold', backgroundColor: '#2D2D42', borderRight: '1px solid #555', position: 'sticky', left: 0, zIndex: 5 }}>
                      {row.month}
                    </TableCell>
                    {transactionTypes.flatMap(type => {
                      const typeData = row.transactionTypes[type] || { uniqueUsers: 0, volume: 0, value: 0, avgValue: 0 };
                      const monthlyUU = getTotalUniqueUsersForType(row, type);

                      return [
                        <TableCell key={`${type}-total-users-${index}`} sx={{ color: '#4FC3F7', borderRight: 'none', fontWeight: 'bold' }}>
                          {monthlyUU.toLocaleString()}
                        </TableCell>,
                        <TableCell key={`${type}-volume-${index}`} sx={{ color: '#FF6384', borderRight: 'none' }}>
                          {typeData.volume.toLocaleString()}
                        </TableCell>,
                        <TableCell key={`${type}-value-${index}`} sx={{ color: '#00FF88', borderRight: 'none' }}>
                          {formatCurrency(typeData.value)}
                        </TableCell>,
                        <TableCell key={`${type}-avg-${index}`} sx={{ color: '#FF9F40', borderRight: 'none' }}>
                          {formatCurrency(typeData.avgValue)}
                        </TableCell>
                      ];
                    })}
                    <TableCell sx={{ color: '#FF9800', fontWeight: 'bold', backgroundColor: '#2D2D42', borderRight: '1px solid #555', position: 'sticky', right: 0, zIndex: 5, textAlign: 'center' }}>
                      {row.comboUsers ? row.comboUsers.toLocaleString() : '0'}
                    </TableCell>
                  </TableRow>
                  
                  {/* Expandable row for VISA merchants */}
                  {hasVisaTransactions && monthMerchants && monthMerchants.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={1 + (transactionTypes.length * 4) + 1} sx={{ p: 0, backgroundColor: 'rgba(255, 152, 0, 0.05)' }}>
                        <Box sx={{ p: 2, pl: 4 }}>
                          <Typography variant="caption" sx={{ color: '#FF9800', fontWeight: 'bold', mb: 1, display: 'block' }}>
                            📊 Top 5 VISA Merchants for {row.month}:
                          </Typography>
                          <Grid container spacing={1}>
                            {monthMerchants.map((merchant, idx) => (
                              <Grid item xs={12} sm={6} md={4} key={idx}>
                                <Box sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  p: 0.5,
                                  borderBottom: '1px solid rgba(255, 152, 0, 0.2)'
                                }}>
                                  <Typography variant="body2" sx={{ color: '#FFF' }}>
                                    {idx + 1}. {merchant.name}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#FF9800' }}>
                                    {merchant.transactionCount} txns | {formatCurrency(merchant.totalValue)}
                                  </Typography>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {emptyRows > 0 && (
              <TableRow style={{ height: 63 * emptyRows }}>
                <TableCell colSpan={1 + (transactionTypes.length * 4) + 1} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, backgroundColor: '#3D3D5C' }}>
        <Typography variant="body2" sx={{ color: '#00FF88' }}>
          Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, data.length)} of {data.length} records
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#00FF88', mr: 1 }}>
            Rows per page:
          </Typography>
          <TextField
            select
            value={rowsPerPage}
            onChange={handleChangeRowsPerPage}
            size="small"
            sx={{ width: '80px', '& .MuiInputBase-root': { color: '#FFF' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' } }}
          >
            {[5, 10, 25, 50].map((option) => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </TextField>
          <IconButton onClick={() => handleChangePage(null, page - 1)} disabled={page === 0} sx={{ color: '#00FF88', ml: 1 }}>←</IconButton>
          <IconButton onClick={() => handleChangePage(null, page + 1)} disabled={page >= Math.ceil(data.length / rowsPerPage) - 1} sx={{ color: '#00FF88' }}>→</IconButton>
        </Box>
      </Box>
    </Box>
  );
};

// Add this state near your other state declarations
const [exportFilter, setExportFilter] = useState({
  open: false,
  amountFilter: 'none', // 'none', 'greater', 'less', 'equal'
  amountValue: '',
  exportType: 'comprehensive' // 'comprehensive' or 'individual'
});

// Add this popup component near your other components
// Beautiful Amount Filter Popup
const AmountFilterPopup = ({ open, onClose, onConfirm, filters, loading }) => {
  const [amountFilter, setAmountFilter] = useState(filters?.amountFilter || 'none');
  const [amountValue, setAmountValue] = useState(filters?.amountValue || '');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  const handleSelectClick = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleMenuItemClick = (value) => {
    setAmountFilter(value);
    setMenuAnchorEl(null);
  };

  const handleConfirm = () => {
    const updatedFilters = {
      ...filters,
      amountFilter: amountFilter,
      amountValue: amountValue
    };
    onConfirm(updatedFilters);
  };

  const handleSkip = () => {
    const updatedFilters = {
      ...filters,
      amountFilter: 'none',
      amountValue: ''
    };
    onConfirm(updatedFilters);
  };

  // Reset state when popup opens
  useEffect(() => {
    if (open) {
      setAmountFilter(filters?.amountFilter || 'none');
      setAmountValue(filters?.amountValue || '');
      setMenuAnchorEl(null); // Reset menu state
    }
  }, [open, filters]);

  // Prevent backdrop click from closing when menu is open
  const handleBackdropClick = (event) => {
    if (menuAnchorEl) {
      event.stopPropagation();
      return;
    }
    onClose();
  };

  return (
    <Backdrop 
      open={open} 
      onClick={handleBackdropClick}
      sx={{ 
        zIndex: (theme) => theme.zIndex.modal + 1,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Card 
        onClick={(e) => e.stopPropagation()} // Prevent card clicks from closing backdrop
        sx={{ 
          backgroundColor: "#2D2D42", 
          p: 4, 
          borderRadius: 3,
          border: '2px solid rgba(0, 255, 136, 0.3)',
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.2)',
          minWidth: 400,
          maxWidth: 500,
          position: 'relative',
          overflow: 'visible'
        }}>
        {/* Close Button */}
        <IconButton 
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: -12,
            top: -12,
            backgroundColor: '#FF6384',
            color: '#FFF',
            '&:hover': { backgroundColor: '#FF4757' },
            width: 32,
            height: 32
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{
            width: 60,
            height: 60,
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '2px solid rgba(0, 255, 136, 0.3)'
          }}>
            <FilterAltIcon sx={{ color: '#00FF88', fontSize: 30 }} />
          </Box>
          <Typography variant="h5" sx={{ color: "#00FF88", fontWeight: 'bold', mb: 1 }}>
            Amount Filter
          </Typography>
          <Typography variant="body2" sx={{ color: "#AAAAAA" }}>
            Add an amount filter to your search (optional)
          </Typography>
        </Box>

        {/* Amount Filter Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: "#AAAAAA", mb: 1 }}>
            Filter by Amount:
          </Typography>
          <TextField
            fullWidth
            value={amountFilter === 'none' ? 'No Amount Filter' : 
                   amountFilter === 'greater' ? 'Greater Than' :
                   amountFilter === 'less' ? 'Less Than' : 'Equal To'}
            onClick={handleSelectClick}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <KeyboardArrowDownIcon sx={{ color: '#00FF88' }} />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiInputBase-root': { 
                color: '#FFF',
                cursor: 'pointer'
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 255, 136, 0.3)' },
            }}
          />
          
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
            container={document.body}
            sx={{
              zIndex: (theme) => theme.zIndex.modal + 2,
              '& .MuiPaper-root': {
                backgroundColor: '#2D2D42',
                color: '#FFF',
                border: '1px solid rgba(0, 255, 136, 0.3)',
              }
            }}
          >
            <MenuItem 
              onClick={() => handleMenuItemClick('none')}
              sx={{
                '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                color: amountFilter === 'none' ? '#00FF88' : '#FFF'
              }}
            >
              No Amount Filter
            </MenuItem>
            <MenuItem 
              onClick={() => handleMenuItemClick('greater')}
              sx={{
                '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                color: amountFilter === 'greater' ? '#00FF88' : '#FFF'
              }}
            >
              Greater Than
            </MenuItem>
            <MenuItem 
              onClick={() => handleMenuItemClick('less')}
              sx={{
                '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                color: amountFilter === 'less' ? '#00FF88' : '#FFF'
              }}
            >
              Less Than
            </MenuItem>
            <MenuItem 
              onClick={() => handleMenuItemClick('equal')}
              sx={{
                '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                color: amountFilter === 'equal' ? '#00FF88' : '#FFF'
              }}
            >
              Equal To
            </MenuItem>
          </Menu>
        </Box>

        {amountFilter !== 'none' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ color: "#AAAAAA", mb: 1 }}>
              Amount Value:
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              placeholder="Enter amount"
              disabled={loading}
              sx={{
                '& .MuiInputBase-root': { color: '#FFF' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 255, 136, 0.3)' }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography variant="body2" sx={{ color: '#AAAAAA' }}>
                      {filters?.currency || 'USD'}
                    </Typography>
                  </InputAdornment>
                )
              }}
            />
            <Typography variant="caption" sx={{ color: '#AAAAAA', mt: 1, display: 'block' }}>
              Filter will be applied to transaction amounts
            </Typography>
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={handleSkip}
            disabled={loading}
            sx={{ 
              color: '#FF6384', 
              borderColor: '#FF6384',
              px: 3,
              '&:hover': { 
                borderColor: '#FF4757', 
                backgroundColor: 'rgba(255, 99, 132, 0.1)' 
              },
              '&:disabled': {
                color: '#666',
                borderColor: '#666'
              }
            }}
          >
            Skip Amount Filter
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={(amountFilter !== 'none' && !amountValue) || loading}
            sx={{ 
              backgroundColor: '#00FF88',
              color: '#000',
              px: 4,
              fontWeight: 'bold',
              '&:hover': { 
                backgroundColor: 'rgba(0, 255, 136, 0.8)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0, 255, 136, 0.3)'
              },
              transition: 'all 0.2s',
              '&:disabled': {
                backgroundColor: '#666',
                color: '#999'
              }
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Apply Search'}
          </Button>
        </Box>
      </Card>
    </Backdrop>
  );
};


// Helper function to get filter description
const getFilterDescription = (filter) => {
  switch (filter.amountFilter) {
    case 'greater': return 'Greater Than';
    case 'less': return 'Less Than';
    case 'equal': return 'Equal To';
    default: return '';
  }
};

// Modified export handler function
const handleExportClick = (exportType) => {
  setExportFilter({
    open: true,
    amountFilter: 'none',
    amountValue: '',
    exportType: exportType
  });
};

// Export confirmation handler
const handleExportConfirm = () => {
  const { exportType, amountFilter, amountValue } = exportFilter;
  
  if (exportType === 'comprehensive') {
    exportComprehensiveToExcel(
      comprehensiveData, 
      allTransactionTypes, 
      totalComboUsers, 
      'comprehensive-report',
      { amountFilter, amountValue }
    );
  } else if (exportType === 'individual') {
    // You can similarly modify exportIndividualRecords to accept filters
    exportIndividualRecords({ amountFilter, amountValue });
  }
  
  setExportFilter({ ...exportFilter, open: false });
  
  setSnackbar({
    open: true,
    message: `Exported data with ${amountFilter !== 'none' ? getFilterDescription(exportFilter) + ' ' + amountValue + ' filter' : 'no filter'}`,
    severity: 'success'
  });
};
// Modified exportComprehensiveToExcel function with filtering
const exportComprehensiveToExcel = (data, transactionTypes, totalComboUsers, filename = 'comprehensive-report', amountFilter = null) => {
  // Generate date range string for filename
  let dateRangeStr = '';
  
  if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
    const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '-');
    
    const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '-');
    
    dateRangeStr = ` (${from} to ${to})`;
  } else if (filters.dateRange !== 'custom') {
    const now = new Date();
    let rangeText = '';
    
    switch (filters.dateRange) {
      case 'day':
        rangeText = now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: '2-digit' 
        });
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        rangeText = weekStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: '2-digit' 
        });
        break;
      case 'month':
        rangeText = now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        break;
      default:
        rangeText = 'All Time';
    }
    
    dateRangeStr = ` (${rangeText})`;
  }

  // Apply amount filtering if specified
  let filteredData = data;
  let amountFilterInfo = [];
  let amountFilterStr = '';
  
  // Check if we have amount filter from parameter OR from filters state
  const hasAmountFilter = (amountFilter && amountFilter.amountFilter !== 'none' && amountFilter.amountValue) || 
                         (filters.amountFilter && filters.amountFilter !== 'none' && filters.amountValue);
  
  const effectiveAmountFilter = amountFilter || filters;
  
  if (hasAmountFilter && effectiveAmountFilter.amountFilter !== 'none' && effectiveAmountFilter.amountValue) {
    const amountValue = parseFloat(effectiveAmountFilter.amountValue);
    
    filteredData = data.map(month => {
      const filteredTransactionTypes = { ...month.transactionTypes };
      
      Object.keys(filteredTransactionTypes).forEach(type => {
        const typeData = filteredTransactionTypes[type];
        
        // Apply the amount filter based on the selected condition
        switch (effectiveAmountFilter.amountFilter) {
          case 'greater':
            if (typeData.value <= amountValue) {
              delete filteredTransactionTypes[type];
            }
            break;
          case 'less':
            if (typeData.value >= amountValue) {
              delete filteredTransactionTypes[type];
            }
            break;
          case 'equal':
            if (typeData.value !== amountValue) {
              delete filteredTransactionTypes[type];
            }
            break;
          default:
            break;
        }
      });
      
      return {
        ...month,
        transactionTypes: filteredTransactionTypes
      };
    }).filter(month => Object.keys(month.transactionTypes).length > 0); // Remove months with no matching data
    
    // Add amount filter info for display
    const filterDescription = effectiveAmountFilter.amountFilter === 'greater' ? 'Greater Than' :
                             effectiveAmountFilter.amountFilter === 'less' ? 'Less Than' : 'Equal To';
    amountFilterStr = ` - ${filterDescription} ${effectiveAmountFilter.amountValue} ${filters.currency || 'USD'}`;
    
    amountFilterInfo = [
      ['Filter Information', ''],
      ['Amount Filter', `${filterDescription} ${effectiveAmountFilter.amountValue} ${filters.currency || 'USD'}`],
      []
    ];
  }
  
  // Create detailed sheet in the exact table format
  const worksheetData = [];
  
  // Add filter info if applied
  if (amountFilterInfo.length > 0) {
    worksheetData.push(...amountFilterInfo);
  }
  
  // Add header row (matching your table structure)
  const headerRow = ['Date'];
  transactionTypes.forEach(type => {
    headerRow.push(`${type} - Monthly UU`);
    headerRow.push(`${type} - Volume`);
    headerRow.push(`${type} - Value`);
    headerRow.push(`${type} - Avg. Value`);
  });
  headerRow.push('Combo Users');
  worksheetData.push(headerRow);
  
  // Add data rows (month by month) using filtered data
  filteredData.forEach(month => {
    const row = [month.month];
    
    transactionTypes.forEach(type => {
      const typeData = month.transactionTypes[type] || { 
        uniqueUsers: 0, 
        volume: 0, 
        value: 0, 
        avgValue: 0 
      };
      
      row.push(typeData.uniqueUsers);
      row.push(typeData.volume);
      row.push(typeData.value);
      row.push(typeData.avgValue);
    });
    
    row.push(month.comboUsers || 0);
    worksheetData.push(row);
  });
  
  // Add totals row
  const totalsRow = ['TOTALS'];
  transactionTypes.forEach(type => {
    const totalMonthlyUU = filteredData.reduce((sum, month) => {
      const monthTypeData = month.transactionTypes[type] || { uniqueUsers: 0 };
      return sum + monthTypeData.uniqueUsers;
    }, 0);
    
    const totalVolume = filteredData.reduce((sum, month) => {
      const monthTypeData = month.transactionTypes[type] || { volume: 0 };
      return sum + monthTypeData.volume;
    }, 0);
    
    const totalValue = filteredData.reduce((sum, month) => {
      const monthTypeData = month.transactionTypes[type] || { value: 0 };
      return sum + monthTypeData.value;
    }, 0);
    
    const avgValue = totalVolume > 0 ? totalValue / totalVolume : 0;
    
    totalsRow.push(totalMonthlyUU);
    totalsRow.push(totalVolume);
    totalsRow.push(totalValue);
    totalsRow.push(avgValue);
  });
  
  const totalComboUsersFiltered = filteredData.reduce((sum, month) => sum + (month.comboUsers || 0), 0);
  totalsRow.push(totalComboUsersFiltered);
  
  worksheetData.push([]);
  worksheetData.push(totalsRow);
  
  // Create summary sheet
  const summaryData = [];
  
  // Add filter info to summary sheet
  if (amountFilterInfo.length > 0) {
    summaryData.push(...amountFilterInfo);
  }
  
  summaryData.push(
    ['Transaction Type', 'Total Monthly UU', 'Total Volume', 'Total Value', 'Average Value'],
    ...transactionTypes.map(type => {
      const totalMonthlyUU = filteredData.reduce((sum, month) => {
        const monthTypeData = month.transactionTypes[type] || { uniqueUsers: 0 };
        return sum + monthTypeData.uniqueUsers;
      }, 0);
      
      const totalVolume = filteredData.reduce((sum, month) => {
        const monthTypeData = month.transactionTypes[type] || { volume: 0 };
        return sum + monthTypeData.volume;
      }, 0);
      
      const totalValue = filteredData.reduce((sum, month) => {
        const monthTypeData = month.transactionTypes[type] || { value: 0 };
        return sum + monthTypeData.value;
      }, 0);
      
      const avgValue = totalVolume > 0 ? totalValue / totalVolume : 0;
      
      return [type, totalMonthlyUU, totalVolume, totalValue, avgValue];
    }),
    ['GRAND TOTAL', 
      filteredData.reduce((sum, month) => sum + Object.values(month.transactionTypes).reduce((s, t) => s + t.uniqueUsers, 0), 0),
      filteredData.reduce((sum, month) => sum + Object.values(month.transactionTypes).reduce((s, t) => s + t.volume, 0), 0),
      filteredData.reduce((sum, month) => sum + Object.values(month.transactionTypes).reduce((s, t) => s + t.value, 0), 0),
      filteredData.reduce((sum, month) => sum + Object.values(month.transactionTypes).reduce((s, t) => s + t.volume, 0), 0) > 0 
        ? filteredData.reduce((sum, month) => sum + Object.values(month.transactionTypes).reduce((s, t) => s + t.value, 0), 0) / 
          filteredData.reduce((sum, month) => sum + Object.values(month.transactionTypes).reduce((s, t) => s + t.volume, 0), 0)
        : 0
    ],
    [],
    ['Combo Users Summary', ''],
    ['Total Combo Users (Overall Period)', totalComboUsersFiltered],
    ['Monthly Combo Users Breakdown', ''],
    ...filteredData.map(month => [month.month, month.comboUsers || 0])
  );
  
  const workbook = XLSX.utils.book_new();
  
  // Create summary sheet
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Create detailed sheet
  const detailedSheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  const colWidths = [{ wch: 15 }];
  transactionTypes.forEach(() => {
    colWidths.push({ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 });
  });
  colWidths.push({ wch: 12 });
  
  detailedSheet['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Monthly Details');
  
  XLSX.writeFile(workbook, `${filename}${dateRangeStr}${amountFilterStr}.xlsx`);
};
// Excel export function
const exportDailyToExcel = (data, filename = 'daily-summary') => {
  // Generate date range string for filename
  let dateRangeStr = '';
  
  if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
    const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '-');
    
    const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '-');
    
    dateRangeStr = ` (${from} to ${to})`;
  } else if (filters.dateRange !== 'custom') {
    const now = new Date();
    let rangeText = '';
    
    switch (filters.dateRange) {
      case 'day':
        rangeText = now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: '2-digit' 
        });
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        rangeText = weekStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: '2-digit' 
        });
        break;
      case 'month':
        rangeText = now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        break;
      default:
        rangeText = 'All Time';
    }
    
    dateRangeStr = ` (${rangeText})`;
  }
  
  // Add amount filter info
  let amountFilterStr = '';
  let amountFilterInfo = [];
  
  if (filters.amountFilter && filters.amountFilter !== 'none' && filters.amountValue) {
    const filterDescription = filters.amountFilter === 'greater' ? 'Greater Than' :
                             filters.amountFilter === 'less' ? 'Less Than' : 'Equal To';
    amountFilterStr = ` - ${filterDescription} ${filters.amountValue} ${filters.currency || 'USD'}`;
    
    amountFilterInfo = [
      ['Filter Information', ''],
      ['Amount Filter', `${filterDescription} ${filters.amountValue} ${filters.currency || 'USD'}`],
      []
    ];
  }
  
  const dailyData = data.reduce((acc, item) => {
    const dateKey = new Date(item.Date).toISOString().split('T')[0];
    const dateStr = new Date(item.Date).toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    if (!acc[dateKey]) {
      acc[dateKey] = {
        Date: dateStr,
        UniqueCustomers: 0,
        TotalValue: 0,
        TotalVolume: 0,
        TotalFees: 0,
        TransactionTypes: new Set()
      };
    }
    
    acc[dateKey].UniqueCustomers += item.UniqueCustomers;
    acc[dateKey].TotalValue += item.TotalValue;
    acc[dateKey].TotalVolume += item.TotalVolume;
    acc[dateKey].TotalFees += item.TotalFees;
    acc[dateKey].TransactionTypes.add(item.TransactionType);
    
    return acc;
  }, {});
  
  const worksheetData = Object.values(dailyData).map(item => ({
    Date: item.Date,
    'Unique Customers': item.UniqueCustomers,
    'Total Value': item.TotalValue,
    'Total Volume': item.TotalVolume,
    'Total Fees': item.TotalFees,
    'Transaction Types': Array.from(item.TransactionTypes).join(', ')
  }));
  
  const workbook = XLSX.utils.book_new();
  
  // Create main data worksheet
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  
  // If there's amount filter info, add it at the top of the worksheet
  if (amountFilterInfo.length > 0) {
    // Convert current data to array format
    const currentData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Combine filter info with data
    const combinedData = [...amountFilterInfo, ...currentData];
    
    // Create new worksheet with combined data
    const newWorksheet = XLSX.utils.aoa_to_sheet(combinedData);
    XLSX.utils.book_append_sheet(workbook, newWorksheet, 'Daily Summary');
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Summary');
  }
  
  XLSX.writeFile(workbook, `${filename}${dateRangeStr}${amountFilterStr}.xlsx`);
};

const exportIndividualRecords = async () => {
  try {
    setFilterLoading(true);
    
    // Prepare filter data for individual records
    const filterData = { 
      ...filters,
      transactionTypes: filters.transactionTypes.includes('All') || filters.transactionTypes.length === 0 
        ? 'All' 
        : filters.transactionTypes,
      exportIndividual: true
    };
    
    if (filters.dateRange !== 'custom') {
      filterData.fromDate = '';
      filterData.toDate = '';
    }
    
    // Generate date range string for filename
    let dateRangeStr = '';
    
    if (filters.dateRange === 'custom' && filters.fromDate && filters.toDate) {
      const from = new Date(filters.fromDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).replace(/\//g, '-');
      
      const to = new Date(filters.toDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).replace(/\//g, '-');
      
      dateRangeStr = ` (${from} to ${to})`;
    } else if (filters.dateRange !== 'custom') {
      const now = new Date();
      let rangeText = '';
      
      switch (filters.dateRange) {
        case 'day':
          rangeText = now.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit' 
          });
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          rangeText = weekStart.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit' 
          });
          break;
        case 'month':
          rangeText = now.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
          });
          break;
        default:
          rangeText = 'All Time';
      }
      
      dateRangeStr = ` (${rangeText})`;
    }
    
    // Add amount filter info to filename and data
    let amountFilterStr = '';
    let amountFilterInfo = [];
    
    if (filters.amountFilter && filters.amountFilter !== 'none' && filters.amountValue) {
      const filterDescription = filters.amountFilter === 'greater' ? 'Greater Than' :
                               filters.amountFilter === 'less' ? 'Less Than' : 'Equal To';
      amountFilterStr = ` - ${filterDescription} ${filters.amountValue} ${filters.currency || 'USD'}`;
      
      amountFilterInfo = [
        ['Filter Information', ''],
        ['Amount Filter', `${filterDescription} ${filters.amountValue} ${filters.currency || 'USD'}`],
        []
      ];
    }
    
    // Call API endpoint for individual records
    const response = await axios.post('http://172.16.3.21:3003/api/transtype/individual-records', filterData);
    
    // Format the data for Excel export
    const worksheetData = response.data.map(item => {
      // Get the date value - could be from datetime_req (for VISA) or Date (for others)
      const dateValue = item.datetime_req || item.Date;
      
      return {
        'Account ID': item.AccountId,
        'Transaction Type': item.TransactionType,
        'Date': dateValue ? new Date(dateValue).toLocaleDateString('en-US', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }) : 'N/A',
        'Amount': item.TransactionAmount,
        'Net Fee': item.NetFee,
        'Transaction Fee': item.TransactionFee,
        'Currency': item.Currency || 'USD',
        // Only add Merchant Name for VISA transactions
        'Merchant Name': item.TransactionType === 'VISA Purchase Completion' ? (item.MerchantName || 'N/A') : ''
      };
    });
    
    const workbook = XLSX.utils.book_new();
    
    // Create main data worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // If there's amount filter info, add it at the top of the worksheet
    if (amountFilterInfo.length > 0) {
      const currentData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const combinedData = [...amountFilterInfo, ...currentData];
      const newWorksheet = XLSX.utils.aoa_to_sheet(combinedData);
      XLSX.utils.book_append_sheet(workbook, newWorksheet, 'Individual Records');
    } else {
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Individual Records');
    }
    
    // Write the file with amount filter in filename
    XLSX.writeFile(workbook, `individual-transactions${dateRangeStr}${amountFilterStr}.xlsx`);
    
    setSnackbar({
      open: true,
      message: `Exported ${response.data.length} individual records${amountFilterStr ? ` with ${amountFilterStr.replace(' - ', '')} filter` : ''}`,
      severity: 'success'
    });
    
  } catch (err) {
    console.error('Error exporting individual records:', err);
    setSnackbar({
      open: true,
      message: 'Error exporting individual records',
      severity: 'error'
    });
  } finally {
    setFilterLoading(false);
  }
};


  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

const handleSearchFocus = () => {
  setIsBackdropOpen(true);
  setShowChatInterface(true);
};

const handleBackdropClose = () => {
  if (searchMode === 'text') {
    setIsBackdropOpen(false);
    setShowChatInterface(false);
  }
};

const handleFilterClick = () => {
  setSearchMode('filter');
  setIsBackdropOpen(true);
  setShowChatInterface(false);
  isEditingFilters.current = true; // Mark that we're editing filters
};

// Update handleBackToTextSearch to exit editing mode
const handleBackToTextSearch = () => {
  setSearchMode('text');
  setIsBackdropOpen(true);
  setShowChatInterface(true);
  isEditingFilters.current = false; // Exit editing mode
};


  const validateDateRange = () => {
  if (filters.dateRange === 'custom') {
    if (!filters.fromDate || !filters.toDate) {
      setSnackbar({
        open: true,
        message: 'Please select both From Date and To Date',
        severity: 'error'
      });
      return false;
    }
    
    // Optional: Validate that fromDate is before toDate
    if (new Date(filters.fromDate) > new Date(filters.toDate)) {
      setSnackbar({
        open: true,
        message: 'From Date must be before To Date',
        severity: 'error'
      });
      return false;
    }
  }
  return true;
};


  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };


  // Memoized metrics calculation
// Memoized metrics calculation
// Memoized metrics calculation
const allData = useMemo(() => {
  const totalValue = filteredData.reduce((sum, item) => sum + (item.TotalValue || 0), 0);
  const totalFees = filteredData.reduce((sum, item) => sum + (item.TotalFees || 0), 0);
  
  // Handle both string and number volumes
  const totalVolume = filteredData.reduce((sum, item) => {
    const volume = typeof item.TotalVolume === 'number' 
      ? item.TotalVolume 
      : parseFloat(item.TotalVolume) || 0;
    return sum + volume;
  }, 0);
  
  // Calculate total unique users across all transaction types (actual unique users)
  const totalUniqueUsersCount = totalUniqueUsers.reduce((sum, item) => sum + (item.TotalUniqueUsers || 0), 0);
  
  // Calculate sum of daily unique users (may include duplicates across days)
  const sumOfDailyUniqueUsers = filteredData.reduce((sum, item) => sum + (item.UniqueCustomers || 0), 0);
  
  return [
    { 
      label: "Total Unique Users", 
      value: totalUniqueUsersCount.toString(), 
      subtext: "Actual unique users across period", 
      isPositive: true 
    },
    // { 
    //   label: "Sum of Daily UU", 
    //   value: sumOfDailyUniqueUsers.toString(), 
    //   subtext: "Sum of daily UU (may include duplicates)", 
    //   isPositive: true 
    // },
    { label: "Total Value", value: formatCurrency(totalValue), subtext: "Sum of daily values", isPositive: true },
    { label: "Total Volume", value: totalVolume.toString(), subtext: "Sum of daily volumes", isPositive: true },
    { label: "Total Fees", value: formatCurrency(totalFees), subtext: "Sum of all fees", isPositive: false },
  ];
}, [filteredData, totalUniqueUsers]);
  // Virtualized table row component - FIXED VERSION
  const VirtualizedTable = ({ data }) => {
    const Row = ({ index, style }) => {
      const row = data[index];
      return (
        <TableRow style={style}>
          <TableCell sx={{ color: '#FFF' }}>{row.AccountId}</TableCell>
          <TableCell sx={{ color: '#FFF' }}>{row.TransactionType}</TableCell>
          <TableCell sx={{ color: '#FFF' }}>{formatDate(row.Date)}</TableCell>
          <TableCell sx={{ color: '#00FF88' }}>{formatCurrency(row.TransactionAmount, row.Currency)}</TableCell>
          <TableCell sx={{ color: '#FF6384' }}>{formatCurrency(row.NetFee, row.Currency)}</TableCell>
          <TableCell sx={{ color: '#FF6384' }}>{formatCurrency(row.TransactionFee, row.Currency)}</TableCell>
          <TableCell sx={{ color: '#FFF' }}>{row.Currency}</TableCell>
        </TableRow>
      );
    };

    return (
      <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', height: 440 }}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>Account ID</TableCell>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>Transaction Type</TableCell>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>Date</TableCell>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>Amount</TableCell>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>Net Fee</TableCell>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>Transaction Fee</TableCell>
              <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '10%' }}>Currency</TableCell>
            </TableRow>
          </TableHead>
        </Table>
        <div style={{ height: 400, width: '100%' }}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                width={width}
                itemCount={data.length}
                itemSize={50}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        </div>
      </TableContainer>
    );
  };

  // Alternative approach: Standard table with pagination for better compatibility
 // Daily Summary Table Component
const DailySummaryTable = ({ data }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  
  // Check if VISA transactions exist in the data
  const hasVisaTransactions = useMemo(() => {
    return data.some(item => item.TransactionType === 'VISA Purchase Completion');
  }, [data]);
  
  // Group data by date and calculate daily totals with merchant info
  const dailyData = useMemo(() => {
    const dailyMap = {};
    
    data.forEach(item => {
      const dateStr = new Date(item.Date).toLocaleDateString('en-US', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
      const dateKey = new Date(item.Date).toISOString().split('T')[0];
      
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateStr,
          dateKey: dateKey,
          uniqueCustomers: 0,
          totalValue: 0,
          totalVolume: 0,
          totalFees: 0,
          transactionTypes: new Set(),
          visaMerchants: {} // Track VISA merchants for this day
        };
      }
      
      const volume = typeof item.TotalVolume === 'number' 
        ? item.TotalVolume 
        : parseFloat(item.TotalVolume) || 0;
      
      dailyMap[dateKey].uniqueCustomers += item.UniqueCustomers;
      dailyMap[dateKey].totalValue += item.TotalValue;
      dailyMap[dateKey].totalVolume += volume;
      dailyMap[dateKey].totalFees += item.TotalFees;
      dailyMap[dateKey].transactionTypes.add(item.TransactionType);
      
      // Track merchant if available for VISA transactions
      if (item.TransactionType === 'VISA Purchase Completion' && item.MerchantName) {
        if (!dailyMap[dateKey].visaMerchants[item.MerchantName]) {
          dailyMap[dateKey].visaMerchants[item.MerchantName] = 0;
        }
        dailyMap[dateKey].visaMerchants[item.MerchantName]++;
      }
    });
    
    // Get top merchant for each day
    return Object.values(dailyMap)
      .map(item => {
        let topMerchant = null;
        const merchantEntries = Object.entries(item.visaMerchants);
        if (merchantEntries.length > 0) {
          merchantEntries.sort((a, b) => b[1] - a[1]);
          topMerchant = merchantEntries[0][0];
        }
        
        return {
          ...item,
          transactionTypes: Array.from(item.transactionTypes).join(', '),
          topVisaMerchant: topMerchant
        };
      })
      .sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));
  }, [data]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - dailyData.length) : 0;
  
  return (
    <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', maxHeight: 600 }}>
      <Table stickyHeader size="small">
<TableHead>
  <TableRow>
    <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '10%' }}>
      Date
    </TableCell>
    <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '10%' }}>
      Unique Customers
    </TableCell>
    <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '12%' }}>
      Total Value
    </TableCell>
    <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '10%' }}>
      Total Volume
    </TableCell>
    <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '10%' }}>
      Total Fees
    </TableCell>
    <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '15%' }}>
      Transaction Types
    </TableCell>
    {/* Add Terminal Type columns only when VISA is selected */}
    {hasVisaTransactions && (
      <>
        <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '8%' }} align="center">
          POS
        </TableCell>
        <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '8%' }} align="center">
          Online
        </TableCell>
        <TableCell sx={{ backgroundColor: '#3D3D5C', color: '#00FF88', fontWeight: 'bold', width: '8%' }} align="center">
          ATM
        </TableCell>
      </>
    )}
  </TableRow>
</TableHead>
        <TableBody>
        
{(rowsPerPage > 0
  ? dailyData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  : dailyData
).map((row, index) => {
  // Find the VISA data for this day
  const visaDataForDay = data.find(item => 
    new Date(item.Date).toISOString().split('T')[0] === row.dateKey && 
    item.TransactionType === 'VISA Purchase Completion'
  );
  
  return (
    <TableRow key={index}>
      <TableCell sx={{ color: '#FFF', fontWeight: 'bold' }}>
        {row.date}
      </TableCell>
      <TableCell sx={{ color: '#36A2EB' }}>
        {row.uniqueCustomers.toLocaleString()}
      </TableCell>
      <TableCell sx={{ color: '#00FF88' }}>
        {formatCurrency(row.totalValue)}
      </TableCell>
      <TableCell sx={{ color: '#FF6384' }}>
        {row.totalVolume.toLocaleString()}
      </TableCell>
      <TableCell sx={{ color: '#FF9F40' }}>
        {formatCurrency(row.totalFees)}
      </TableCell>
      <TableCell sx={{ color: '#AAA', fontSize: '0.875rem' }}>
        {row.transactionTypes}
      </TableCell>
      {/* Add Terminal Type counts for VISA days */}
      {hasVisaTransactions && (
        <>
          <TableCell align="center" sx={{ color: '#00FF88' }}>
            {visaDataForDay?.POS_Count?.toLocaleString() || '0'}
          </TableCell>
          <TableCell align="center" sx={{ color: '#FF9800' }}>
            {visaDataForDay?.Online_Count?.toLocaleString() || '0'}
          </TableCell>
          <TableCell align="center" sx={{ color: '#36A2EB' }}>
            {visaDataForDay?.ATM_Count?.toLocaleString() || '0'}
          </TableCell>
        </>
      )}
    </TableRow>
  );
})}
          {emptyRows > 0 && (
            <TableRow style={{ height: 63 * emptyRows }}>
              <TableCell colSpan={hasVisaTransactions ? 7 : 6} />
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, backgroundColor: '#3D3D5C' }}>
        <Typography variant="body2" sx={{ color: '#00FF88' }}>
          Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, dailyData.length)} of {dailyData.length} days
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#00FF88', mr: 1 }}>
            Rows per page:
          </Typography>
          <TextField
            select
            value={rowsPerPage}
            onChange={handleChangeRowsPerPage}
            size="small"
            sx={{ 
              width: '80px',
              '& .MuiInputBase-root': { color: '#FFF' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' }
            }}
          >
            {[10, 20, 50, 100].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <IconButton 
            onClick={() => handleChangePage(null, page - 1)} 
            disabled={page === 0}
            sx={{ color: '#00FF88', ml: 1 }}
          >
            ←
          </IconButton>
          <IconButton 
            onClick={() => handleChangePage(null, page + 1)} 
            disabled={page >= Math.ceil(dailyData.length / rowsPerPage) - 1}
            sx={{ color: '#00FF88' }}
          >
            →
          </IconButton>
        </Box>
      </Box>
    </TableContainer>
  );
};
const EnhancedChart = ({ data, monthlyUniqueUsers }) => {
  const [aggregation, setAggregation] = useState('daily');
  const [chartType, setChartType] = useState('line');
  const [selectedTransactionType, setSelectedTransactionType] = useState('All');
  const [showDataLabels, setShowDataLabels] = useState(false);

  // Function to format numbers with K/M abbreviations
  const formatNumber = (value) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  };

  // Function to format dates consistently
  const formatDateKey = (date, aggType) => {
    if (aggType === 'daily') {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (aggType === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      
      const year = weekStart.getFullYear();
      const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');
      const day = weekStart.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (aggType === 'monthly') {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    return '';
  };

  // Function to format display labels
  const formatDisplayLabel = (key, aggType) => {
    if (aggType === 'daily') {
      const [year, month, day] = key.split('-');
      return `${month}/${day}/${year}`;
    } else if (aggType === 'weekly') {
      const [year, month, day] = key.split('-');
      const weekStart = new Date(`${year}-${month}-${day}`);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return `${month}/${day}/${year} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}/${weekEnd.getFullYear()}`;
    } else if (aggType === 'monthly') {
      const [year, month] = key.split('-');
      return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return key;
  };

  // Get all unique transaction types from data
  const transactionTypes = useMemo(() => {
    const types = new Set(['All']);
    data.forEach(item => {
      if (item.TransactionType) {
        types.add(item.TransactionType);
      }
    });
    monthlyUniqueUsers.forEach(item => {
      if (item.TransactionType) {
        types.add(item.TransactionType);
      }
    });
    return Array.from(types).sort();
  }, [data, monthlyUniqueUsers]);

  // Process monthly unique users data
  const monthlyUniqueUsersByType = useMemo(() => {
    const map = {};
    
    monthlyUniqueUsers.forEach(item => {
      // Check if required fields exist
      if (!item || !item.MonthYear) {
        console.warn("Skipping invalid monthly unique user item:", item);
        return;
      }
      
      // Parse the MonthYear field (format: "YYYY-MM")
      const [year, month] = item.MonthYear.split('-');
      
      if (!year || !month) {
        console.warn("Skipping item with invalid MonthYear format:", item);
        return;
      }
      
      // Create consistent month key format (same as what formatDateKey produces)
      const monthKey = `${year}-${month.padStart(2, '0')}`;
      
      if (!map[monthKey]) {
        map[monthKey] = {};
      }
      
      // Store unique users count by transaction type
      const transactionType = item.TransactionType || 'Unknown';
      const uniqueUsers = item.MonthlyUniqueUsers || item.UniqueUsers || 0;
      
      map[monthKey][transactionType] = uniqueUsers;
    });
    
    return map;
  }, [monthlyUniqueUsers]);

  // Filter data based on selected transaction type
  const filteredData = useMemo(() => {
    if (selectedTransactionType === 'All') {
      return data;
    }
    return data.filter(item => item.TransactionType === selectedTransactionType);
  }, [data, selectedTransactionType]);

  // Aggregate data based on selected timeframe and transaction type
  const aggregatedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return { labels: [], datasets: [] };
    }
    
    const aggregated = {};
    
    filteredData.forEach(item => {
      if (!item.Date) return;
      
      const date = new Date(item.Date);
      if (isNaN(date.getTime())) return;
      
      const key = formatDateKey(date, aggregation);
      
      // Main aggregation
      if (!aggregated[key]) {
        aggregated[key] = {
          totalAmount: 0,
          totalFees: 0,
          totalVolume: 0,
          uniqueCustomers: 0,
          timestamp: aggregation === 'weekly' 
            ? new Date(key).getTime()
            : date.getTime()
        };
      }
      
      const volume = typeof item.TotalVolume === 'number' 
        ? item.TotalVolume 
        : parseFloat(item.TotalVolume) || 0;
      
      aggregated[key].totalAmount += item.TotalValue || 0;
      aggregated[key].totalFees += item.TotalFees || 0;
      aggregated[key].totalVolume += volume;
      
      // For daily and weekly, use the item's unique customers
      if (aggregation !== 'monthly') {
        aggregated[key].uniqueCustomers += item.UniqueCustomers || 0;
      }
    });
    
    // For monthly aggregation, handle unique users from monthlyUniqueUsers data
    if (aggregation === 'monthly') {
      Object.keys(aggregated).forEach(key => {
        // Key is already in format "YYYY-MM" for monthly
        const monthKey = key;
        
        if (selectedTransactionType === 'All') {
          // Sum all transaction types for the month
          let totalUnique = 0;
          if (monthlyUniqueUsersByType[monthKey]) {
            Object.values(monthlyUniqueUsersByType[monthKey]).forEach(count => {
              totalUnique += count;
            });
          }
          aggregated[key].uniqueCustomers = totalUnique;
        } else {
          // Use specific transaction type's unique users
          aggregated[key].uniqueCustomers = monthlyUniqueUsersByType[monthKey]?.[selectedTransactionType] || 0;
        }
      });
    }
    
    // Sort keys by timestamp
    const sortedKeys = Object.keys(aggregated).sort((a, b) => 
      aggregated[a].timestamp - aggregated[b].timestamp
    );
    
    // Create display labels
    const labels = sortedKeys.map(key => formatDisplayLabel(key, aggregation));
    
    // Create datasets
    const datasets = [
      {
        label: 'Total Value',
        data: sortedKeys.map(key => aggregated[key]?.totalAmount || 0),
        backgroundColor: '#00CC6E',
        borderColor: '#00CC6E',
        tension: 0.3,
        fill: false,
        yAxisID: 'y',
        borderWidth: 3
      },
      {
        label: 'Total Volume',
        data: sortedKeys.map(key => aggregated[key]?.totalVolume || 0),
        backgroundColor: '#FF6384',
        borderColor: '#FF6384',
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
        borderWidth: 3
      },
      {
        label: 'Unique Customers',
        data: sortedKeys.map(key => aggregated[key]?.uniqueCustomers || 0),
        backgroundColor: '#36A2EB',
        borderColor: '#36A2EB',
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
        borderWidth: 3
      }
    ];
    
    return { labels, datasets };
  }, [filteredData, aggregation, selectedTransactionType, monthlyUniqueUsersByType]);

  // Safe data for chart - always ensure valid structure
  const chartData = useMemo(() => {
    if (!aggregatedData || !aggregatedData.datasets) {
      return { labels: [], datasets: [] };
    }
    return aggregatedData;
  }, [aggregatedData]);

  // Chart options configuration
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top', 
        labels: { 
          color: '#FFF',
          usePointStyle: true,
          padding: 20
        } 
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toLocaleString();
            }
            return label;
          }
        }
      },
      // Data labels configuration
      datalabels: {
        display: showDataLabels,
        color: '#FFFFFF',
        font: {
          weight: 'bold',
          size: chartType === 'bar' ? 12 : 10
        },
        formatter: function(value, context) {
          // Only show labels for bar charts or when value is significant
          if (chartType === 'bar' || value > 1000) {
            return formatNumber(value);
          }
          return null;
        },
        // Adjust anchor and alignment based on chart type
        anchor: chartType === 'bar' ? 'end' : 'center',
        align: chartType === 'bar' ? 'end' : 'top',
        offset: chartType === 'bar' ? 0 : 5,
        clamp: true,
        backgroundColor: function(context) {
          // Add background for better readability on line charts
          return chartType === 'line' ? 'rgba(0, 0, 0, 0.7)' : null;
        },
        borderRadius: 3,
        padding: chartType === 'line' ? {left: 4, right: 4, top: 2, bottom: 2} : 0
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    scales: {
      x: { 
        ticks: { color: '#AAA' }, 
        grid: { color: '#444' } 
      },
      y: { 
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Amount ($)',
          color: '#AAA'
        },
        ticks: { 
          color: '#AAA',
          // Apply number formatting for bar charts with weekly/monthly aggregation
          callback: function(value) {
            if ((chartType === 'bar' && (aggregation === 'weekly' || aggregation === 'monthly')) || value >= 1000) {
              return formatNumber(value);
            }
            return value.toLocaleString();
          }
        }, 
        grid: { color: '#444' } 
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Count',
          color: '#AAA'
        },
        ticks: { 
          color: '#AAA',
          // Apply number formatting for bar charts with weekly/monthly aggregation
          callback: function(value) {
            if ((chartType === 'bar' && (aggregation === 'weekly' || aggregation === 'monthly')) || value >= 1000) {
              return formatNumber(value);
            }
            return value.toLocaleString();
          }
        },
        grid: { display: false }
      }
    }
  }), [chartType, aggregation, showDataLabels]);

  // Debug: Log the processed monthly data
  useEffect(() => {
    // console.log("Processed Monthly Unique Users:", monthlyUniqueUsersByType);
  }, [monthlyUniqueUsersByType]);

  return (
    <Card sx={{ backgroundColor: "#2D2D42", p: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: "#FFFFFF" }}>
          Transaction Trends {selectedTransactionType !== 'All' ? `- ${selectedTransactionType}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            select
            size="small"
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            sx={{ 
              minWidth: 120,
              '& .MuiInputBase-root': { color: '#FFF' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' }
            }}
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={selectedTransactionType}
            onChange={(e) => setSelectedTransactionType(e.target.value)}
            sx={{ 
              minWidth: 120,
              '& .MuiInputBase-root': { color: '#FFF' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' }
            }}
          >
            {transactionTypes.map(type => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            sx={{ 
              minWidth: 120,
              '& .MuiInputBase-root': { color: '#FFF' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' }
            }}
          >
            <MenuItem value="line">Line Chart</MenuItem>
            <MenuItem value="bar">Bar Chart</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={showDataLabels}
            onChange={(e) => setShowDataLabels(e.target.value)}
            sx={{ 
              minWidth: 120,
              '& .MuiInputBase-root': { color: '#FFF' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00FF88' }
            }}
          >
            <MenuItem value={true}>Show Labels</MenuItem>
            <MenuItem value={false}>Hide Labels</MenuItem>
          </TextField>
        </Box>
      </Box>
      <Box sx={{ height: '500px' }}>
        {chartData.datasets.length > 0 ? (
          chartType === 'line' ? (
            <Line 
              data={chartData} 
              options={chartOptions} 
              plugins={[ChartDataLabels]} 
            />
          ) : (
            <Bar 
              data={chartData} 
              options={chartOptions} 
              plugins={[ChartDataLabels]} 
            />
          )
        ) : (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            color: '#AAA'
          }}>
            <Typography variant="body1">
              {selectedTransactionType === 'All' ? 'No data available' : `No data available for ${selectedTransactionType}`}
            </Typography>
          </Box>
        )}
      </Box>
    </Card>
  );
};
  // Update the useEffect for click detection
// Update the useEffect for click detection

// Update the click outside detection
useEffect(() => {
  const handleClickOutside = (event) => {
    const searchCard = document.querySelector('.search-card');
    const menuItems = document.querySelectorAll('.MuiMenu-paper, .MuiPopover-paper, .MuiModal-backdrop');
    const advancedFilters = document.querySelector('.advanced-filters-container');
    
    // Check if click is inside the search card
    const isInsideSearchCard = searchCard && searchCard.contains(event.target);
    
    // Check if click is inside advanced filters
    const isInsideAdvancedFilters = advancedFilters && advancedFilters.contains(event.target);
    
    // Check if click is inside any open menu/popover/modal (like dropdowns, date pickers)
    const isInsideMenu = Array.from(menuItems).some(menu => 
      menu && menu.contains(event.target)
    );
    
    // Only close if clicking outside the search card, advanced filters, AND any open menus
    if (!isInsideSearchCard && !isInsideAdvancedFilters && !isInsideMenu) {
      setIsBackdropOpen(false);
      setSearchMode('text');
      setShowChatInterface(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);

 const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]); // This will trigger whenever chatMessages updates

  // Loading overlay for Merchant Analytics
const MerchantAnalyticsLoader = () => (
    <Card sx={{ 
        backgroundColor: "#2D2D42", 
        mt: 3, 
        p: 3, 
        borderRadius: 2,
        border: '1px solid rgba(255, 152, 0, 0.3)',
        position: 'relative',
        overflow: 'hidden'
    }}>
        <Box sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(45, 45, 66, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            borderRadius: 2
        }}>
            <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={40} sx={{ color: '#FF9800', mb: 2 }} />
                <Typography variant="body2" sx={{ color: '#FF9800' }}>
                    Loading VISA Merchant Analytics...
                </Typography>
                <Typography variant="caption" sx={{ color: '#AAA', display: 'block', mt: 1 }}>
                    This may take a few moments
                </Typography>
            </Box>
        </Box>
        
        {/* Placeholder content to maintain layout */}
        <Typography variant="h6" sx={{ color: "#FF9800", mb: 2, opacity: 0.5 }}>
            🏪 VISA Merchant Analytics
        </Typography>
        <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ color: "#00FF88", mb: 1, opacity: 0.5 }}>
                Overall Statistics
            </Typography>
            <Grid container spacing={2}>
                {[1, 2, 3, 4].map((item) => (
                    <Grid item xs={6} sm={3} key={item}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: '#AAA', opacity: 0.5 }}>Loading...</Typography>
                            <Typography variant="h6" sx={{ color: '#00FF88', opacity: 0.5 }}>---</Typography>
                        </Box>
                    </Grid>
                ))}
            </Grid>
        </Box>
        <Box>
            <Typography variant="subtitle2" sx={{ color: "#00FF88", mb: 1, opacity: 0.5 }}>
                Top 5 Merchants
            </Typography>
            <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', opacity: 0.5 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: '#00FF88' }}>Rank</TableCell>
                            <TableCell sx={{ color: '#00FF88' }}>Merchant Name</TableCell>
                            <TableCell sx={{ color: '#00FF88' }} align="right">Volume</TableCell>
                            <TableCell sx={{ color: '#00FF88' }} align="right">Value</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {[1, 2, 3, 4, 5].map((item) => (
                            <TableRow key={item}>
                                <TableCell sx={{ color: '#FF9800' }}>#{item}</TableCell>
                                <TableCell sx={{ color: '#FFF' }}>Loading...</TableCell>
                                <TableCell align="right" sx={{ color: '#FF6384' }}>---</TableCell>
                                <TableCell align="right" sx={{ color: '#00FF88' }}>$---</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    </Card>
);


  return (
    <>
      <Layout />
      <br/><br/>
      <Container style={{maxWidth:'1350px'}} sx={{ }}>
        <Box sx={{ flexGrow: 1 }}>
<Typography variant="h4" component="h1" sx={{ color: "#00FF88", mt: 4, mb: 2 }}>
  <span style={{ fontSize: "14px", color: "#ffffff" }}>Lazarus BI</span>
  <br /> Custom Report Builder
  <span style={{ fontSize: "24px", color: "#ffffff" }}>
    {" "}<br />
    O'mari Dashboard<br />
  </span>
  <Divider sx={{ borderColor: '#444', mt: 2 }} />
</Typography>

{/* Search Details Section */}
{/* Search Details Section */}
{/* Search Details Section */}
{filteredData.length > 0 && (
  <Card sx={{ 
    backgroundColor: "#2D2D42", 
    p: 2, 
    borderRadius: 2,
    border: '1px solid rgba(0, 255, 136, 0.2)'
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h6" sx={{ color: "#00FF88" }}>
        Current Search Details
      </Typography>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="body2" sx={{ color: "#AAAAAA" }}>
          {filteredData.length} daily records
        </Typography>
        <Typography variant="body2" sx={{ color: "#36A2EB" }}>
          {totalUniqueUsers.reduce((sum, item) => sum + item.TotalUniqueUsers, 0)} actual unique users
        </Typography>
        <Typography variant="body2" sx={{ color: "#FF6384" }}>
          {filteredData.reduce((sum, item) => sum + item.UniqueCustomers, 0)} sum of daily unique counts
        </Typography>
       
      </Box>
    </Box>

    {/* Amount Filter Status */}
    {filters.amountFilter && filters.amountFilter !== 'none' && filters.amountValue && (
      <Box sx={{ 
        mt: 1, 
        p: 1.5, 
        backgroundColor: 'rgba(0, 255, 136, 0.1)', 
        borderRadius: 1,
        border: '1px solid rgba(0, 255, 136, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography variant="body2" sx={{ color: "#00FF88", fontWeight: 'bold' }}>
          Amount Filter: {filters.amountFilter === 'greater' ? 'Greater Than ' :
                         filters.amountFilter === 'less' ? 'Less Than ' : 'Equal To '} 
          {filters.amountValue} {filters.currency || 'USD'}
        </Typography>
      </Box>
    )}
    
    {/* Network Providers Filter Status */}
    {filters.networkProviders && filters.networkProviders.length > 0 && (
      <Box sx={{ 
        mt: 1, 
        p: 1.5, 
        backgroundColor: 'rgba(74, 144, 226, 0.1)', 
        borderRadius: 1,
        border: '1px solid rgba(74, 144, 226, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box>
          <Typography variant="body2" sx={{ color: "#4A90E2", fontWeight: 'bold' }}>
            Airtime Purchase - Network Providers:
          </Typography>
          <Typography variant="body2" sx={{ color: "#FFFFFF", ml: 2 }}>
            {filters.networkProviders.join(', ')}
          </Typography>
        </Box>
        <Chip 
          label="Specialized Query" 
          size="small" 
          sx={{ 
            backgroundColor: '#4A90E2', 
            color: '#FFF',
            fontSize: '0.7rem'
          }} 
        />
      </Box>
    )}
    {/* Remittance Providers Filter Status */}
{filters.remittanceProviders && filters.remittanceProviders.length > 0 && (
  <Box sx={{ 
    mt: 1, 
    p: 1.5, 
    backgroundColor: 'rgba(155, 89, 182, 0.1)', 
    borderRadius: 1,
    border: '1px solid rgba(155, 89, 182, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}>
    <Box>
      <Typography variant="body2" sx={{ color: "#9B59B6", fontWeight: 'bold' }}>
        Remittances - Providers:
      </Typography>
      <Typography variant="body2" sx={{ color: "#FFFFFF", ml: 2 }}>
        {filters.remittanceProviders.join(', ')}
      </Typography>
    </Box>
    <Chip 
      label="Specialized Query" 
      size="small" 
      sx={{ 
        backgroundColor: '#9B59B6', 
        color: '#FFF',
        fontSize: '0.7rem'
      }} 
    />
  </Box>
)}

    {/* Bundle Providers Filter Status */}
{filters.bundleProviders && filters.bundleProviders.length > 0 && (
  <Box sx={{ 
    mt: 1, 
    p: 1.5, 
    backgroundColor: 'rgba(255, 193, 7, 0.1)', 
    borderRadius: 1,
    border: '1px solid rgba(255, 193, 7, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}>
    <Box>
      <Typography variant="body2" sx={{ color: "#FFC107", fontWeight: 'bold' }}>
        Bundle Purchase - Providers:
      </Typography>
      <Typography variant="body2" sx={{ color: "#FFFFFF", ml: 2 }}>
        {filters.bundleProviders.join(', ')}
      </Typography>
    </Box>
    <Chip 
      label="Specialized Query" 
      size="small" 
      sx={{ 
        backgroundColor: '#FFC107', 
        color: '#000',
        fontSize: '0.7rem'
      }} 
    />
  </Box>
)}

    {/* VISA Merchants Filter Status */}
    {filters.visaMerchants && filters.visaMerchants.length > 0 && (
      <Box sx={{ 
        mt: 1, 
        p: 1.5, 
        backgroundColor: 'rgba(0, 255, 136, 0.1)', 
        borderRadius: 1,
        border: '1px solid rgba(0, 255, 136, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box>
          <Typography variant="body2" sx={{ color: "#00FF88", fontWeight: 'bold' }}>
            VISA Purchase Completion - Merchants:
          </Typography>
          <Typography variant="body2" sx={{ color: "#FFFFFF", ml: 2 }}>
            {filters.visaMerchants.join(', ')}
          </Typography>
        </Box>
        <Chip 
          label="Specialized Query" 
          size="small" 
          sx={{ 
            backgroundColor: '#9C27B0', 
            color: '#FFF',
            fontSize: '0.7rem'
          }} 
        />
      </Box>
    )}
    
    <Grid container spacing={2} sx={{ mt: 1 }}>
      <Grid item xs={12} sm={6} md={4}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: "#AAAAAA", mr: 1 }}>
            Transaction Type:
          </Typography>
          <Typography variant="body2" sx={{ color: "#FFFFFF", fontWeight: 'bold' }}>
            {Array.isArray(filters.transactionTypes) 
              ? (filters.transactionTypes.length === 0 || filters.transactionTypes.length === (transactionTypes ? transactionTypes.filter(type => type !== "All").length : 0))
                ? 'All' 
                : filters.transactionTypes.join(', ')
              : filters.transactionTypes || 'All'}
          </Typography>
        </Box>
      </Grid>
      
      <Grid item xs={12} sm={6} md={4}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: "#AAAAAA", mr: 1 }}>
            Date Range:
          </Typography>
          <Typography variant="body2" sx={{ color: "#FFFFFF", fontWeight: 'bold' }}>
            {filters.dateRange === 'custom' 
              ? `Custom (${filters.fromDate || ''} to ${filters.toDate || ''})` 
              : (filters.dateRange ? filters.dateRange.charAt(0).toUpperCase() + filters.dateRange.slice(1) : 'Month')}
          </Typography>
        </Box>
      </Grid>
      
      <Grid item xs={12} sm={6} md={4}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: "#AAAAAA", mr: 1 }}>
            Currency:
          </Typography>
          <Typography variant="body2" sx={{ color: "#FFFFFF", fontWeight: 'bold' }}>
            {filters.currency || 'USD'}
          </Typography>
        </Box>
      </Grid>
    </Grid>

{/* Show selected VISA subtypes */}
{filters.visaSubTypes && filters.visaSubTypes.length > 0 && (
  <Box sx={{ 
    mt: 2, 
    p: 1.5, 
    backgroundColor: 'rgba(0, 255, 136, 0.1)', 
    borderRadius: 1,
    border: '1px solid rgba(0, 255, 136, 0.3)'
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
      <Typography variant="body2" sx={{ color: "#00FF88", fontWeight: 'bold' }}>
        Selected VISA Types ({filters.visaSubTypes.length}):
      </Typography>
      <Button 
        size="small" 
        onClick={() => {
          setFilters(prev => ({ ...prev, visaSubTypes: [] }));
          setSnackbar({
            open: true,
            message: 'Cleared VISA type filters',
            severity: 'info'
          });
        }}
        sx={{ 
          color: '#FF6384', 
          fontSize: '0.7rem',
          minWidth: 'auto',
          p: 0.5
        }}
      >
        Clear All
      </Button>
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {filters.visaSubTypes.map((type, idx) => (
        <Chip 
          key={idx}
          label={type}
          size="small"
          onDelete={() => {
            const newTypes = filters.visaSubTypes.filter((_, i) => i !== idx);
            setFilters(prev => ({ ...prev, visaSubTypes: newTypes }));
          }}
          sx={{ backgroundColor: 'rgba(0, 255, 136, 0.2)', color: '#FFF' }}
        />
      ))}
    </Box>
  </Box>
)}

    {/* Data Source Information */}
    
    {searchQuery && (
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" sx={{ color: "#AAAAAA", mr: 1 }}>
          Search Query:
        </Typography>
        <Typography variant="body2" sx={{ color: "#FFFFFF", fontStyle: 'italic' }}>
          "{searchQuery}"
        </Typography>
      </Box>
    )}
  </Card>
)}

          {/* Key Metrics Cards */}
{/* Key Metrics Cards */}
<Grid container spacing={4} sx={{ mt: 1 }}>
  {allData.map((item, index) => (
    <Grid item xs={12} sm={6} md={3} key={index}> {/* Changed from md={3} to md={2.4} for 5 items */}
      <Card sx={{ 
        backgroundColor: "#2D2D42", 
        color: "#FFFFFF", 
        p: 0, 
        borderRadius: 2, 
        boxShadow: 3,
        borderLeft: `4px solid ${item.isPositive ? "#00FF88" : "#FF6384"}`,
        position: 'relative',
        height: '100%'
      }}>
        <CardContent sx={{ textAlign: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1, fontSize: '0.9rem' }}>
            {item.label}
          </Typography>
          <Typography variant="h4" sx={{ 
            color: item.isPositive ? "#00FF88" : "#FF6384", 
            fontWeight: "bold",
            mb: 1,
            fontSize: '1.5rem'
          }}>
            {item.value}
          </Typography>
          <Typography variant="body2" sx={{ color: "#AAAAAA", fontSize: '0.7rem' }}>
            {item.subtext}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  ))}
</Grid>

{/* Terminal Type Totals Card - Only show when VISA is selected */}
{filters.transactionTypes && filters.transactionTypes.includes('VISA Purchase Completion') && filteredData.length > 0 && (
  <Card sx={{ 
    backgroundColor: "#2D2D42", 
    mt: 2, 
    p: 2, 
    borderRadius: 2,
    border: '1px solid rgba(0, 255, 136, 0.3)'
  }}>
    <Typography variant="subtitle1" sx={{ color: "#FF9800", mb: 1.5, fontWeight: 'bold' }}>
      📱 VISA Type Totals
    </Typography>
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Box sx={{ textAlign: 'center', p: 1.5, backgroundColor: 'rgba(0, 255, 136, 0.1)', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ color: '#AAA' }}>POS (01)</Typography>
          <Typography variant="h5" sx={{ color: '#00FF88', fontWeight: 'bold' }}>
            {filteredData.reduce((sum, day) => sum + (day.POS_Count || 0), 0).toLocaleString()}
          </Typography>
          <Typography variant="caption" sx={{ color: '#AAA' }}>transactions</Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ textAlign: 'center', p: 1.5, backgroundColor: 'rgba(255, 152, 0, 0.1)', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ color: '#AAA' }}>Online (95)</Typography>
          <Typography variant="h5" sx={{ color: '#FF9800', fontWeight: 'bold' }}>
            {filteredData.reduce((sum, day) => sum + (day.Online_Count || 0), 0).toLocaleString()}
          </Typography>
          <Typography variant="caption" sx={{ color: '#AAA' }}>transactions</Typography>
        </Box>
      </Grid>
    </Grid>
  </Card>
)}

{/* VISA Merchant Analytics Section */}
{((filters.transactionTypes.includes('VISA') || 
   filters.transactionTypes.length === 0 || 
   filters.transactionTypes.includes('All')) && 
   filters.visaSubTypes && 
   filters.visaSubTypes.length > 0 &&  // Only show if subtypes are selected
   (visaTableLoading || 
    (visaOverallStats && visaOverallStats.totalMerchants > 0) || 
    showVisaMerchantsEnhanced)) && (
    
    visaTableLoading ? (
        <Card sx={{ 
            backgroundColor: "#2D2D42", 
            mt: 3, 
            p: 3, 
            borderRadius: 2,
            border: '1px solid rgba(255, 152, 0, 0.3)',
            textAlign: 'center'
        }}>
            <CircularProgress size={40} sx={{ color: '#FF9800', mb: 2 }} />
            <Typography variant="body2" sx={{ color: '#FF9800' }}>
                Loading VISA Merchant Data...
            </Typography>
            <Typography variant="caption" sx={{ color: '#AAA', display: 'block', mt: 1 }}>
                Fetching merchant analytics for selected VISA types
            </Typography>
        </Card>
    ) : (
        visaOverallStats && visaOverallStats.totalMerchants > 0 && (
            <>
                {/* VISA Merchant Statistics Card - Overall Stats */}
                <Card sx={{ 
                    backgroundColor: "#2D2D42", 
                    mt: 3, 
                    p: 2, 
                    borderRadius: 2,
                    border: '1px solid rgba(0, 255, 136, 0.2)'
                }}>
                    <Typography variant="h6" sx={{ color: "#FF9800", mb: 2 }}>
                        🏪 VISA Merchant Analytics
                    </Typography>
                    
                    {/* Overall Statistics */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ color: "#00FF88", mb: 1 }}>
                            Overall Statistics
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6} sm={3}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>
                                        Merchants in Date Range
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: '#00FF88' }}>
                                        {visaOverallStats?.totalMerchants?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>
                                        Total Merchants (All Time)
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: '#FF9800' }}>
                                        {visaOverallStats?.totalAllMerchants?.toLocaleString() || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#AAA' }}>
                                        ({((visaOverallStats?.totalMerchants / visaOverallStats?.totalAllMerchants) * 100).toFixed(1)}% coverage)
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Customers</Typography>
                                    <Typography variant="h6" sx={{ color: '#36A2EB' }}>
                                        {visaOverallStats?.totalUniqueCustomers?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Value</Typography>
                                    <Typography variant="h6" sx={{ color: '#00FF88' }}>
                                        {formatCurrency(visaOverallStats?.totalValue || 0)}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                        
                        {/* Progress bar showing coverage */}
                        <Box sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#AAA' }}>
                                    Merchant Coverage
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#FF9800' }}>
                                    {((visaOverallStats?.totalMerchants / visaOverallStats?.totalAllMerchants) * 100).toFixed(1)}%
                                </Typography>
                            </Box>
                            <Box sx={{ 
                                width: '100%', 
                                height: 6, 
                                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                                borderRadius: 3,
                                overflow: 'hidden'
                            }}>
                                <Box sx={{ 
                                    width: `${(visaOverallStats?.totalMerchants / visaOverallStats?.totalAllMerchants) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#FF9800',
                                    borderRadius: 3,
                                    transition: 'width 0.3s ease'
                                }} />
                            </Box>
                        </Box>
                    </Box>
                </Card>

                {/* VISA Overall Statistics Card */}
                {showVisaMerchantsEnhanced && visaOverallStats && (
                    <Card sx={{ 
                        backgroundColor: "#2D2D42", 
                        mt: 3, 
                        p: 2, 
                        borderRadius: 2,
                        border: '1px solid rgba(255, 152, 0, 0.3)'
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ color: "#FF9800" }}>
                                📊 VISA Merchant Based Overall Statistics
                            </Typography>
                            <Typography variant="body2" sx={{ 
                                color: '#FF9800', 
                                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2,
                                fontWeight: 'bold'
                            }}>
                                {filters.dateRange === 'custom' && filters.fromDate && filters.toDate ? (
                                    `${new Date(filters.fromDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(filters.toDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                ) : filters.dateRange === 'month' ? (
                                    new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                ) : filters.dateRange === 'week' ? (
                                    `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                ) : filters.dateRange === 'day' ? (
                                    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                ) : 'All Time'}
                            </Typography>
                        </Box>
                        
                        <Grid container spacing={2}>
                            <Grid item xs={6} sm={2.5}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>
                                        Merchants
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: '#00FF88' }}>
                                        {visaOverallStats.totalMerchants?.toLocaleString() || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#FF9800' }}>
                                        of {visaOverallStats.totalAllMerchants?.toLocaleString() || 0} total
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={2.5}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>Unique Customers</Typography>
                                    <Typography variant="h6" sx={{ color: '#36A2EB' }}>
                                        {visaOverallStats.totalUniqueCustomers?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={2.5}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Value</Typography>
                                    <Typography variant="h6" sx={{ color: '#00FF88' }}>
                                        {formatCurrency(visaOverallStats.totalValue || 0)}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={2.5}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Volume</Typography>
                                    <Typography variant="h6" sx={{ color: '#FF6384' }}>
                                        {visaOverallStats.totalVolume?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} sm={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#AAA' }}>Avg Transaction</Typography>
                                    <Typography variant="h6" sx={{ color: '#FF9F40' }}>
                                        {formatCurrency(visaOverallStats.avgTransactionValue || 0)}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Card>
                )}

                {/* VISA Merchants Table */}
                {showVisaMerchantsEnhanced && visaMerchantsEnhanced.length > 0 && (
                    <VisaMerchantsTable
                        merchants={visaMerchantsEnhanced}
                        pagination={merchantPaginationEnhanced}
                        onPageChange={(newPage) => setMerchantPaginationEnhanced(prev => ({ ...prev, currentPage: newPage }))}
                        onPageSizeChange={(newSize) => {
                            setMerchantPaginationEnhanced(prev => ({ ...prev, currentPage: 1, pageSize: newSize }));
                        }}
                        onSortChange={(field, order) => setMerchantSortEnhanced({ field, order })}
                        onSearch={(term) => {
                            setMerchantSearchEnhanced(term);
                            setMerchantPaginationEnhanced(prev => ({ ...prev, currentPage: 1 }));
                        }}
                        onMerchantClick={(merchant) => {
                            fetchMerchantDetails(merchant);
                        }}
                        onPlayAround={handlePlayAround}
                        hasSearchResults={merchantSearchEnhanced !== ''}
                        loading={visaTableLoading}
                        sortField={merchantSortEnhanced.field}
                        totalSearchResults={totalSearchResults}
                        sortOrder={merchantSortEnhanced.order}
                        totalAllMerchants={visaOverallStats?.totalAllMerchants || 0}
                        currentSearchTerm={merchantSearchEnhanced}
                    />
                )}
            </>
        )
    )
)}
{/* VISA Overall Statistics Card - Only show when VISA is selected */}
{showVisaMerchantsEnhanced && 
 visaOverallStats && 
 (filters.transactionTypes.includes('VISA Purchase Completion') || 
  filters.transactionTypes.length === 0 || 
  filters.transactionTypes.includes('All')) && (
    <Card sx={{ 
        backgroundColor: "#2D2D42", 
        mt: 3, 
        p: 2, 
        borderRadius: 2,
        border: '1px solid rgba(255, 152, 0, 0.3)'
    }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#FF9800" }}>
                📊 VISA Merchant Based Overall Statistics
            </Typography>
            <Typography variant="body2" sx={{ 
                color: '#FF9800', 
                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                fontWeight: 'bold'
            }}>
                {filters.dateRange === 'custom' && filters.fromDate && filters.toDate ? (
                    `${new Date(filters.fromDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(filters.toDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                ) : filters.dateRange === 'month' ? (
                    new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                ) : filters.dateRange === 'week' ? (
                    `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                ) : filters.dateRange === 'day' ? (
                    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                ) : 'All Time'}
            </Typography>
        </Box>
        
        <Grid container spacing={2}>
            <Grid item xs={6} sm={2.5}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#AAA' }}>
                        Merchants {filters.dateRange === 'custom' ? '(Date Range)' : 
                                 filters.dateRange === 'month' ? '(This Month)' :
                                 filters.dateRange === 'week' ? '(This Week)' :
                                 filters.dateRange === 'day' ? '(Today)' : '(All Time)'}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#00FF88' }}>
                        {visaOverallStats.totalMerchants?.toLocaleString() || 0} | <span style={{ color: "#FF9800", fontWeight: 'bold', fontSize : '13px' }}>{visaOverallStats.totalAllMerchants?.toLocaleString() || 0}</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#AAA' }}>
                        {((visaOverallStats.totalMerchants / visaOverallStats.totalAllMerchants) * 100).toFixed(1)}% coverage
                    </Typography>
                </Box>
            </Grid>
            <Grid item xs={6} sm={2.5}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Customers</Typography>
                    <Typography variant="h6" sx={{ color: '#36A2EB' }}>
                        {visaOverallStats.totalUniqueCustomers?.toLocaleString() || 0}
                    </Typography>
                </Box>
            </Grid>
            <Grid item xs={6} sm={2.5}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Value</Typography>
                    <Typography variant="h6" sx={{ color: '#00FF88' }}>
                        {formatCurrency(visaOverallStats.totalValue || 0)}
                    </Typography>
                </Box>
            </Grid>
            <Grid item xs={6} sm={2.5}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#AAA' }}>Total Volume</Typography>
                    <Typography variant="h6" sx={{ color: '#FF6384' }}>
                        {visaOverallStats.totalVolume?.toLocaleString() || 0}
                    </Typography>
                </Box>
            </Grid>
            <Grid item xs={6} sm={2}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#AAA' }}>Avg Transaction</Typography>
                    <Typography variant="h6" sx={{ color: '#FF9F40' }}>
                        {formatCurrency(visaOverallStats.avgTransactionValue || 0)}
                    </Typography>
                </Box>
            </Grid>
        </Grid>
        <br/><br/>
    </Card>
)}

{showVisaMerchantsEnhanced && 
 visaMerchantsEnhanced.length > 0 && 
 (filters.transactionTypes.includes('VISA Purchase Completion') || 
  filters.transactionTypes.length === 0 || 
  filters.transactionTypes.includes('All')) && (
    <VisaMerchantsTable
        merchants={visaMerchantsEnhanced}
        pagination={merchantPaginationEnhanced}
        onPageChange={(newPage) => setMerchantPaginationEnhanced(prev => ({ ...prev, currentPage: newPage }))}
        onPageSizeChange={(newSize) => {
            setMerchantPaginationEnhanced(prev => ({ ...prev, currentPage: 1, pageSize: newSize }));
        }}
        onSortChange={(field, order) => setMerchantSortEnhanced({ field, order })}
        onSearch={(term) => {
            setMerchantSearchEnhanced(term);
            setMerchantPaginationEnhanced(prev => ({ ...prev, currentPage: 1 }));
        }}
        onMerchantClick={(merchant) => {
        fetchMerchantDetails(merchant);  // Call the new function
    }}
        loading={visaTableLoading}
        sortField={merchantSortEnhanced.field}
        sortOrder={merchantSortEnhanced.order}
            onPlayAround={handlePlayAround}  // NEW PROP
            totalSearchResults={totalSearchResults}  // Add this line
            hasSearchResults={merchantSearchEnhanced !== ''}  // NEW PROP - true when search was performed
        totalAllMerchants={visaOverallStats?.totalAllMerchants || 0}  // Add this line
        currentSearchTerm={merchantSearchEnhanced}  // Add this line
    />
)}
          {/* Charts Section */}
          {filteredData.length > 0 && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
              <EnhancedChart 
                data={filteredData} 
                monthlyUniqueUsers={monthlyUniqueUsers} 
              />
              </Grid>
            </Grid>
          )}

          {/* Transaction Data Table */}
        {filteredData.length > 0 && (
          <Card sx={{ 
            backgroundColor: "#2D2D42", 
            mt: 3, 
            p: 2, 
            borderRadius: 2,
            overflow: 'hidden', // Prevent content from overflowing the card
            maxWidth: '100%' // Ensure card doesn't exceed container width
          }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 2,
              flexWrap: 'wrap', // Allow buttons to wrap on smaller screens
              gap: 1 // Add spacing between elements when wrapped
            }}>
              <Typography variant="h6" sx={{ color: "#FFFFFF" }}>
                {viewMode === 'detailed' ? 'Transaction Data' : 'Comprehensive View'}
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                flexWrap: 'wrap', // Allow buttons to wrap
                gap: 1 // Add spacing between buttons
              }}>
                <Typography variant="body2" sx={{ color: "#00FF88", display: 'inline' }}>
                  {viewMode === 'detailed' ? filteredData.length : comprehensiveData.length} records found
                </Typography>

                        
                {/* View Mode Toggle */}
                <Button 
                  variant="outlined" 
                  onClick={() => setViewMode(viewMode === 'detailed' ? 'comprehensive' : 'detailed')}
                  sx={{ 
                    color: '#00FF88', 
                    borderColor: '#00FF88',
                    '&:hover': { borderColor: '#00FF88', backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                    whiteSpace: 'nowrap' // Prevent button text from wrapping
                  }}
                >
                  {viewMode === 'detailed' ? 'Show Comprehensive View' : 'Show Detailed View'}
                </Button>
                
               {/* Replace your current export buttons with these */}
              <Button 
                variant="outlined" 
                onClick={() => viewMode === 'detailed' 
                    ? exportDailyToExcel(filteredData, 'transactions-report') 
                      : exportComprehensiveToExcel(comprehensiveData, allTransactionTypes, totalComboUsers, 'comprehensive-report', {
          amountFilter: filters.amountFilter,
          amountValue: filters.amountValue
        })
                  }
                startIcon={<DownloadIcon />}
                sx={{ 
                  color: '#00FF88', 
                  borderColor: '#00FF88',
                  '&:hover': { borderColor: '#00FF88', backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                  whiteSpace: 'nowrap'
                }}
              >
                Export to Excel
              </Button>
                        <Button 
                  variant="outlined" 
                  onClick={exportIndividualRecords}
                  disabled={filterLoading}
                  startIcon={<DownloadIcon />}
                  sx={{ 
                    color: '#00FF88', 
                    borderColor: '#00FF88',
                    '&:hover': { borderColor: '#00FF88', backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                    whiteSpace: 'nowrap'
                  }}
                >
                  {filterLoading ? 'Loading...' : 'Export Individuals'}
                </Button>
              </Box>
            </Box>
            

        {viewMode === 'detailed' ? (
  <DailySummaryTable data={filteredData} />
) : (
  <ComprehensiveTable 
    data={comprehensiveData} 
    transactionTypes={allTransactionTypes} 
    totalComboUsers={totalComboUsers}
    monthlyTopMerchants={monthlyTopMerchants}
  />
)}
          </Card>
        )}


          {filteredData.length === 0 && !filterLoading && (
            <Card sx={{ backgroundColor: "#2D2D42", mt: 3, p: 4, borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ color: "#AAAAAA" }}>
                No data to display. Apply filters to see transaction data.
              </Typography>
            </Card>
          )}
          <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '40px 0' }} />
<CustomerCohortAnalyzer />
          <br/><br/>
          <br/><br/>
          <Typography variant="body2" sx={{ mt: 4, color: "#FFFFFF", textAlign: "center" }}>
            Powered by OMDS
          </Typography>
          <br/><br/>
        </Box>
      </Container>
<Backdrop 
  open={isBackdropOpen} 
  sx={{ 
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    backdropFilter: 'blur(5px)',
    zIndex: (theme) => theme.zIndex.drawer + 1,
  }} 
/>

{/* Always visible input field at the bottom */}
<Box sx={{
  position: 'fixed',
  bottom: 70,
  left: '50%',
  transform: 'translateX(-50%)',
  width: '80%',
  maxWidth: '800px',
  zIndex: (theme) => theme.zIndex.drawer + 2
}} className="search-card">
  <Card sx={{
    backgroundColor: 'rgba(45, 45, 66, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
    border: '1px solid rgba(0, 255, 136, 0.2)',
    display: 'flex',
    flexDirection: 'column'
  }}>
    {searchMode === 'text' ? (
      <>
        {/* Chat Messages Area - Only show when backdrop is open (textfield focused) */}
          {isBackdropOpen && (
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto', 
        p: 2,
        maxHeight: '300px',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(0, 255, 136, 0.3)',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(0, 255, 136, 0.5)',
        }
      }}>
        {chatMessages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Ask me anything about your data...
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleQuickAction('Show me Top Visa Merchants from last week')}
                sx={{ color: '#00FF88', borderColor: '#00FF88', fontSize: '0.75rem' }}
              >
                📅 Top Visa Merchants 
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleQuickAction('What are my top transaction types?')}
                sx={{ color: '#00FF88', borderColor: '#00FF88', fontSize: '0.75rem' }}
              >
                📈 Top Types
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleQuickAction('Show me airtime purchases')}
                sx={{ color: '#00FF88', borderColor: '#00FF88', fontSize: '0.75rem' }}
              >
                📱 Airtime
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            {chatMessages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {/* This invisible element will be our scroll target */}
            <div ref={messagesEndRef} />
          </>
        )}
      </Box>
    )}

        {/* Input Area - ALWAYS VISIBLE */}
        <Box sx={{ p: 0.5, borderTop: isBackdropOpen ? '1px solid rgba(0, 255, 136, 0.1)' : 'none' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Ask Lazarus anything about your data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleNaturalLanguageSearch();
              }
            }}
            onFocus={handleSearchFocus}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#FFF',
                '& fieldset': {
                  borderColor: 'rgba(0, 255, 136, 0.3)',
                  borderRadius: '25px'
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0, 255, 136, 0.5)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'rgba(0, 255, 136, 0.8)'
                }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#00FF88' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNaturalLanguageSearch();
                    }}
                    disabled={!searchQuery.trim() || filterLoading}
                    sx={{ color: '#00FF88' }}
                    title="Send message"
                  >
                    <SendIcon />
                  </IconButton>
                  <IconButton 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterClick();
                    }}
                    sx={{ color: '#00FF88', ml: 1 }}
                    title="Advanced Filters"
                  >
                    <FilterAltIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>
      </>
    ) : (
<Box sx={{ padding: 1.2 }} className="advanced-filters-container">
  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
    <Typography variant="subtitle1" sx={{ color: '#00FF88' }}>
      Advanced Filters
    </Typography>
    <IconButton 
      onClick={handleBackToTextSearch}
      sx={{ color: '#00FF88' }}
      title="Back to text search"
    >
      <KeyboardIcon />
    </IconButton>
  </Box>
  
  <Grid container spacing={2}>
    {/* Transaction Type */}
<Grid item xs={12} md={4}>
 <TextField
  select
  fullWidth
  label="Transaction Types"
  SelectProps={{
    multiple: true,
    value: filters.transactionTypes || [],
    onChange: (e) => {
      const selected = e.target.value;
      const previousTypes = filters.transactionTypes || [];
      
      // Handle "All" selection logic
      if (selected.includes("All")) {
        const allTypes = transactionTypes.filter(type => type !== "All");
        setFilters({ 
          ...filters, 
          transactionTypes: allTypes,
          visaSubTypes: []  // Reset VISA subtypes when All is selected
        });
      } else {
        // Check which transaction types were removed
        const removedTypes = previousTypes.filter(type => !selected.includes(type));
        
        // If VISA was removed, clear visaSubTypes
        const updatedFilters = { ...filters, transactionTypes: selected };
        
        if (removedTypes.includes("VISA")) {
          updatedFilters.visaSubTypes = [];  // Reset VISA subtypes
        }
        
        if (removedTypes.includes("Airtime Purchase")) {
          updatedFilters.networkProviders = [];
        }
        if (removedTypes.includes("Bundle Purchase")) {
          updatedFilters.bundleProviders = [];
        }
        if (removedTypes.includes("Remittances")) {
          updatedFilters.remittanceProviders = [];
        }
        if (removedTypes.includes("VISA")) {
          updatedFilters.visaMerchants = [];
        }
        
        setFilters(updatedFilters);
      }
    },
    renderValue: (selected) => {
      const availableTypes = transactionTypes.filter(type => type !== "All");
      if (selected.length === 0 || selected.length === availableTypes.length) {
        return 'All';
      }
      return selected.join(', ');
    }
  }}
    sx={{
      '& .MuiInputLabel-root': { color: '#AAA' },
      '& .MuiOutlinedInput-root': {
        color: '#FFF',
        '& fieldset': { borderColor: 'rgba(0, 255, 136, 0.3)' }
      }
    }}
  >
    <MenuItem value="All">
      <Checkbox 
        checked={filters.transactionTypes?.length === transactionTypes.filter(type => type !== "All").length}
        indeterminate={
          filters.transactionTypes?.length > 0 && 
          filters.transactionTypes?.length < transactionTypes.filter(type => type !== "All").length
        }
      />
      <ListItemText primary="All" />
    </MenuItem>
    
    {transactionTypes
      .filter(type => type !== "All")
      .flatMap((type) => {
        const items = [
          <MenuItem 
            key={type} 
            value={type}
            sx={{ 
              backgroundColor: (filters.transactionTypes || []).includes(type) ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
              '&:hover': {
                backgroundColor: (filters.transactionTypes || []).includes(type) ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.08)'
              }
            }}
          >
            <Checkbox checked={(filters.transactionTypes || []).includes(type)} />
            <ListItemText primary={type} />
          </MenuItem>
        ];

        // Add network providers right after Airtime Purchase
        if (type === "Airtime Purchase" && (filters.transactionTypes || []).includes("Airtime Purchase")) {
          items.push(
            ...["NETONE", "TELECEL", "ECONET"].map((network) => (
              <Box 
                key={`network-${network}`}
                sx={{ 
                  pl: 4,
                  backgroundColor: (filters.networkProviders || []).includes(network) 
                    ? 'rgba(0, 255, 136, 0.2)' 
                    : 'rgba(255, 255, 255, 0.8)',
                  borderLeft: '3px solid rgba(0, 255, 136, 0.3)',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: (filters.networkProviders || []).includes(network)
                      ? 'rgba(0, 255, 136, 0.3)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const currentNetworks = filters.networkProviders || [];
                  const newNetworks = currentNetworks.includes(network)
                    ? currentNetworks.filter(n => n !== network)
                    : [...currentNetworks, network];
                  
                  setFilters({ ...filters, networkProviders: newNetworks });
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', p: 0.2 }}>
                  <Checkbox 
                    checked={(filters.networkProviders || []).includes(network)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentNetworks = filters.networkProviders || [];
                      const newNetworks = currentNetworks.includes(network)
                        ? currentNetworks.filter(n => n !== network)
                        : [...currentNetworks, network];
                      
                      setFilters({ ...filters, networkProviders: newNetworks });
                    }}
                    sx={{ 
                      color: '#77867fff',
                      '&.Mui-checked': {
                        color: '#2d62f3ff',
                      }
                    }}
                  />
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#000000ff', 
                      fontSize: '0.9rem',
                      ml: 1
                    }}
                  >
                    {network}
                  </Typography>
                </Box>
              </Box>
            ))
          );

          // Add selected networks summary for Airtime Purchase
          if ((filters.networkProviders || []).length > 0) {
            items.push(
              <Box 
                key="network-summary"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(0, 255, 136, 0.15)',
                  borderLeft: '3px solid rgba(0, 255, 136, 0.5)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#21523bff', fontSize: '0.7rem', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                  Selected Airtime Networks:
                </Typography>
                <Typography variant="caption" sx={{ color: '#000000', fontSize: '0.7rem' }}>
                  {(filters.networkProviders || []).join(', ')}
                </Typography>
              </Box>
            );
          } else {
            // Show placeholder when no networks selected for Airtime Purchase
            items.push(
              <Box 
                key="network-placeholder"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#AAA', fontSize: '0.7rem', fontStyle: 'italic' }}>
                  No airtime networks selected
                </Typography>
              </Box>
            );
          }
        }

        // Add bundle providers right after Bundle Purchase
        if (type === "Bundle Purchase" && (filters.transactionTypes || []).includes("Bundle Purchase")) {
          items.push(
            ...["NETONE", "TELECEL", "ECONET"].map((bundleProvider) => (
              <Box 
                key={`bundle-${bundleProvider}`}
                sx={{ 
                  pl: 4,
                  backgroundColor: (filters.bundleProviders || []).includes(bundleProvider) 
                    ? 'rgba(255, 193, 7, 0.2)' 
                    : 'rgba(255, 255, 255, 0.8)',
                  borderLeft: '3px solid rgba(255, 193, 7, 0.3)',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: (filters.bundleProviders || []).includes(bundleProvider)
                      ? 'rgba(255, 193, 7, 0.3)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const currentProviders = filters.bundleProviders || [];
                  const newProviders = currentProviders.includes(bundleProvider)
                    ? currentProviders.filter(b => b !== bundleProvider)
                    : [...currentProviders, bundleProvider];
                  
                  setFilters({ ...filters, bundleProviders: newProviders });
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', p: 0.2 }}>
                  <Checkbox 
                    checked={(filters.bundleProviders || []).includes(bundleProvider)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentProviders = filters.bundleProviders || [];
                      const newProviders = currentProviders.includes(bundleProvider)
                        ? currentProviders.filter(b => b !== bundleProvider)
                        : [...currentProviders, bundleProvider];
                      
                      setFilters({ ...filters, bundleProviders: newProviders });
                    }}
                    sx={{ 
                      color: '#77867fff',
                      '&.Mui-checked': {
                        color: '#FFC107',
                      }
                    }}
                  />
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#000000ff', 
                      fontSize: '0.9rem',
                      ml: 1
                    }}
                  >
                    {bundleProvider}
                  </Typography>
                </Box>
              </Box>
            ))
          );

          // Add selected bundle providers summary
          if ((filters.bundleProviders || []).length > 0) {
            items.push(
              <Box 
                key="bundle-summary"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(255, 193, 7, 0.15)',
                  borderLeft: '3px solid rgba(255, 193, 7, 0.5)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#856404', fontSize: '0.7rem', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                  Selected Bundle Providers:
                </Typography>
                <Typography variant="caption" sx={{ color: '#000000', fontSize: '0.7rem' }}>
                  {(filters.bundleProviders || []).join(', ')}
                </Typography>
              </Box>
            );
          } else {
            // Show placeholder when no bundle providers selected
            items.push(
              <Box 
                key="bundle-placeholder"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#AAA', fontSize: '0.7rem', fontStyle: 'italic' }}>
                  No bundle providers selected
                </Typography>
              </Box>
            );
          }
        }

        // Add remittance providers right after Remittances
        if (type === "Remittances" && (filters.transactionTypes || []).includes("Remittances")) {
          items.push(
            ...["ZEAM", "HelloPaisa"].map((remittanceProvider) => (
              <Box 
                key={`remittance-${remittanceProvider}`}
                sx={{ 
                  pl: 4,
                  backgroundColor: (filters.remittanceProviders || []).includes(remittanceProvider) 
                    ? 'rgba(155, 89, 182, 0.2)' 
                    : 'rgba(255, 255, 255, 0.8)',
                  borderLeft: '3px solid rgba(155, 89, 182, 0.3)',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: (filters.remittanceProviders || []).includes(remittanceProvider)
                      ? 'rgba(155, 89, 182, 0.3)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const currentProviders = filters.remittanceProviders || [];
                  const newProviders = currentProviders.includes(remittanceProvider)
                    ? currentProviders.filter(r => r !== remittanceProvider)
                    : [...currentProviders, remittanceProvider];
                  
                  setFilters({ ...filters, remittanceProviders: newProviders });
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', p: 0.2 }}>
                  <Checkbox 
                    checked={(filters.remittanceProviders || []).includes(remittanceProvider)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentProviders = filters.remittanceProviders || [];
                      const newProviders = currentProviders.includes(remittanceProvider)
                        ? currentProviders.filter(r => r !== remittanceProvider)
                        : [...currentProviders, remittanceProvider];
                      
                      setFilters({ ...filters, remittanceProviders: newProviders });
                    }}
                    sx={{ 
                      color: '#77867fff',
                      '&.Mui-checked': {
                        color: '#9B59B6',
                      }
                    }}
                  />
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#000000ff', 
                      fontSize: '0.9rem',
                      ml: 1
                    }}
                  >
                    {remittanceProvider}
                  </Typography>
                </Box>
              </Box>
            ))
          );

          // Add selected remittance providers summary
          if ((filters.remittanceProviders || []).length > 0) {
            items.push(
              <Box 
                key="remittance-summary"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(155, 89, 182, 0.15)',
                  borderLeft: '3px solid rgba(155, 89, 182, 0.5)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#4A235A', fontSize: '0.7rem', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                  Selected Remittance Providers:
                </Typography>
                <Typography variant="caption" sx={{ color: '#000000', fontSize: '0.7rem' }}>
                  {(filters.remittanceProviders || []).join(', ')}
                </Typography>
              </Box>
            );
          } else {
            // Show placeholder when no remittance providers selected
            items.push(
              <Box 
                key="remittance-placeholder"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#AAA', fontSize: '0.7rem', fontStyle: 'italic' }}>
                  No remittance providers selected
                </Typography>
              </Box>
            );
          }
        }

        // Add VISA Purchase Completion merchants right after VISA Purchase Completion
        if (type === "VISA Purchase Completion" && (filters.transactionTypes || []).includes("VISA Purchase Completion")) {


          // Add selected VISA merchants summary
          if ((filters.visaMerchants || []).length > 0) {
            items.push(
              <Box 
                key="visa-summary"
                sx={{ 
                  pl: 4,
                  py: 1.5,
                  backgroundColor: 'rgba(0, 255, 136, 0.15)',
                  borderLeft: '3px solid rgba(0, 255, 136, 0.5)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#21523bff', fontSize: '0.7rem', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                  Selected VISA Merchants:
                </Typography>
                <Typography variant="caption" sx={{ color: '#000000', fontSize: '0.7rem' }}>
                  {(filters.visaMerchants || []).join(', ')}
                </Typography>
              </Box>
            );
          }
        }

        return items;
      })}
  </TextField>
</Grid>
    {/* Date Range */}
    <Grid item xs={12} md={4}>
      <TextField
        select
        fullWidth
        label="Date Range"
        value={filters.dateRange}
        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
        sx={{
          '& .MuiInputLabel-root': { color: '#AAA' },
          '& .MuiOutlinedInput-root': {
            color: '#FFF',
            '& fieldset': { borderColor: 'rgba(0, 255, 136, 0.3)' }
          }
        }}
      >
        <MenuItem value="day">Today</MenuItem>
        <MenuItem value="week">This Week</MenuItem>
        <MenuItem value="month">This Month</MenuItem>
        <MenuItem value="custom">Custom Range</MenuItem>
      </TextField>
    </Grid>

    {/* Currency */}
    <Grid item xs={12} md={4}>
      <TextField
        select
        fullWidth
        label="Currency"
        value={filters.currency}
        onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
        sx={{
          '& .MuiInputLabel-root': { color: '#AAA' },
          '& .MuiOutlinedInput-root': {
            color: '#FFF',
            '& fieldset': { borderColor: 'rgba(0, 255, 136, 0.3)' }
          }
        }}
      >
        {['USD', 'ZWL', 'All'].map((cur) => (
          <MenuItem key={cur} value={cur}>{cur}</MenuItem>
        ))}
      </TextField>
    </Grid>

    {/* Custom Date Pickers */}
    {filters.dateRange === 'custom' && (
      <>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="date"
            label="From Date"
            value={filters.fromDate}
            onChange={(e) => {
              const newFilters = { ...filters, fromDate: e.target.value };
              setFilters(newFilters);
              
              // Validate after update
              setTimeout(() => {
                if (newFilters.dateRange === 'custom' && (!newFilters.fromDate || !newFilters.toDate)) {
                  setSnackbar({
                    open: true,
                    message: 'Both dates are required for custom range',
                    severity: 'warning'
                  });
                }
              }, 100);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiInputLabel-root': { color: '#AAA' },
              '& .MuiOutlinedInput-root': {
                color: '#FFF',
                '& fieldset': { borderColor: 'rgba(0, 255, 136, 0.3)' }
              }
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="date"
            label="To Date"
            value={filters.toDate}
            onChange={(e) => {
              const newFilters = { ...filters, toDate: e.target.value };
              setFilters(newFilters);
              
              // Validate after update
              setTimeout(() => {
                if (newFilters.dateRange === 'custom' && (!newFilters.fromDate || !newFilters.toDate)) {
                  setSnackbar({
                    open: true,
                    message: 'Both dates are required for custom range',
                    severity: 'warning'
                  });
                }
              }, 100);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiInputLabel-root': { color: '#AAA' },
              '& .MuiOutlinedInput-root': {
                color: '#FFF',
                '& fieldset': { borderColor: 'rgba(0, 255, 136, 0.3)' }
              }
            }}
          />
        </Grid>
      </>
    )}
  </Grid>
  
  <Button
    fullWidth
    variant="contained"
    onClick={applyFilters}
    disabled={filterLoading}
    sx={{
      mt: 2,
      backgroundColor: '#00FF88',
      color: '#000',
      '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.8)' },
      borderRadius: '12px',
      py: 1.5,
      fontWeight: 'bold'
    }}
  >
    {filterLoading ? <CircularProgress size={24} /> : 'Apply Filters'}
  </Button>
</Box>
          )}
 </Card>
 

</Box>
{/* // Replace the FilterConfirmationPopup with AmountFilterPopup */}
<AmountFilterPopup
  open={filterConfirmation.open}
  onClose={() => setFilterConfirmation({ open: false, filters: null })}
  onConfirm={executeFilterApplication}
  filters={filterConfirmation.filters || {}}
  loading={filterLoading}
/>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

<MerchantDetailsModal
    open={merchantDetails.open}
    onClose={closeMerchantDetails}
    merchant={merchantDetails.merchant}
    transactions={merchantDetails.transactions}
    summary={merchantDetails.summary}
    loading={merchantDetails.loading}
    pagination={merchantDetails.pagination}
    onPageChange={handleMerchantDetailsPageChange}
    onPageSizeChange={handleMerchantDetailsPageSizeChange}
    filters={filters}
    setSnackbar={setSnackbar}  // Pass this
/>
<PlayAroundPopup
    open={showPlayAroundPopup}
    onClose={() => setShowPlayAroundPopup(false)}
    searchResults={searchResults}
    filters={filters}
    onExportSummary={handleExportCombinedSummary}
    onExportCustomers={handleExportSelectedCustomers}
    loading={analysisLoading}  // Add this line
/>

{/* VISA Subtype Selection Popup */}
<VisaSubtypePopup
  open={visaSubtypePopup.open}
  onClose={() => setVisaSubtypePopup({ open: false, selectedTypes: [], pendingFilters: null })}
  onConfirm={handleVisaSubtypeConfirm}
  loading={filterLoading}
/>

    </>

    
    
  );
};

export default Dashboard;