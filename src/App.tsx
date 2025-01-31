import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ShoppingCart, Menu, Star, Heart, Upload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import config from './config';

interface Product {
  id: number;
  Vendor_Product_Number?: string;
  Product_Name?: string;
  Product_Specs?: string;
  Unit_Of_Measure?: string;
  MSRP?: number;
  Dealer_Costs?: number;
  'In Stock'?: boolean; // Use string key for "In Stock"
  'Product URL'?: string; // Use string key for "Product URL"
  Product_Category?: string;
  Product_Category_URL?: string;
  Product_Subcategory?: string;
  Product_Subcategory_URL?: string;
  Product_Image?: string;
  Vendor_Name?: string;
  Vendor_Number?: string;
  Client_Key?: string;
}

function App() {
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [searchTerm, setSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState(''); // State for category search
  const [vendorSearchTerm, setVendorSearchTerm] = useState(''); // New state for vendor search
  const [isGridView, setIsGridView] = useState(true); // State for view mode
  const [chatGptResponse, setChatGptResponse] = useState('');
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', content: "Hello! How can I help you today?" }]); // Initialize with a welcome message
  const [userInput, setUserInput] = useState('');
  const chatContainerRef = useRef(null); // Ref for the chat container

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File upload started");
    const file = event.target.files?.[0];

    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", file.name);
    setError("");
    setIsLoading(true);
    setProgress({ current: 0, total: 0 });

    try {
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        setError("Please upload an Excel file (.xlsx or .xls)");
        setIsLoading(false);
        console.log("Invalid file type");
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      console.log("File loaded into buffer");

      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      console.log("Workbook read successfully");

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log("Data converted to JSON, total rows:", jsonData.length);

      const totalItems = jsonData.length;
      setProgress({ current: 0, total: totalItems });

      // Process items in chunks to show progress
      const chunkSize = 100;
      const newProducts: Product[] = [];

      for (let i = 0; i < jsonData.length; i += chunkSize) {
        const chunk = jsonData.slice(i, i + chunkSize);
        console.log(`Processing chunk ${i / chunkSize + 1}`);

        // Process chunk

        const processedChunk = chunk.map((row: any, index) => {
                // Data cleaning and type handling
                let inStock = row['In Stock'];
                if (typeof inStock === 'string') {
                  inStock = inStock.toLowerCase() === 'true' || inStock === 'y'; // Convert string to boolean
                } else if (typeof inStock !== 'boolean' && typeof inStock !== 'number' && inStock !== null && inStock !== undefined) {
                  console.warn("Unexpected 'In Stock' type:", typeof inStock, inStock);
                  inStock = false; // Default to false for unexpected types
                } else if (typeof inStock === 'number'){
                    inStock = inStock > 0
                }

                let msrp = row.MSRP;
                  if (typeof msrp === 'string') {
                    msrp = parseFloat(msrp.replace(/[^0-9.-]+/g, '')); // Remove currency symbols, commas, etc.
                    if (isNaN(msrp)) {
                      console.warn("Invalid MSRP:", row.MSRP); // Log if parsing fails
                      msrp = undefined; // Set to undefined if parsing fails
                    }
                  } else if (typeof msrp !== 'number' && msrp !== undefined && msrp !== null) {
                     console.warn("Unexpected MSRP type:", typeof msrp, msrp);
                     msrp = undefined
                  }

                  let dealerCosts = row.Dealer_Costs;
                  if (typeof dealerCosts === 'string') {
                    dealerCosts = parseFloat(dealerCosts.replace(/[^0-9.-]+/g, '')); // Remove currency symbols, commas, etc.
                    if (isNaN(dealerCosts)) {
                      console.warn("Invalid Dealer_Costs:", row.Dealer_Costs); // Log if parsing fails
                      dealerCosts = undefined; // Set to undefined if parsing fails
                    }
                  } else if (typeof dealerCosts !== 'number' && dealerCosts !== undefined && dealerCosts !== null){
                    console.warn("Unexpected Dealer_Costs type:", typeof dealerCosts, dealerCosts)
                    dealerCosts = undefined
                  }

                return {
                  id: i + index + 1,
                  Vendor_Product_Number: row.Vendor_Product_Number,
                  Product_Name: row.Product_Name,
                  Product_Specs: row.Product_Specs,
                  Unit_Of_Measure: row.Unit_Of_Measure,
                  MSRP: msrp,
                  Dealer_Costs: dealerCosts,
                  'In Stock': inStock,
                  'Product URL': row['Product URL'],
                  Product_Category: row.Product_Category,
                  Product_Category_URL: row.Product_Category_URL,
                  Product_Subcategory: row.Product_Subcategory,
                  Product_Subcategory_URL: row.Product_Subcategory_URL,
                  Product_Image: row.Product_Image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', // Provide a default image URL
                  Vendor_Name: row.Vendor_Name,
                  Vendor_Number: row.Vendor_Number,
                  Client_Key: row.Client_Key,
                };
              });

        newProducts.push(...processedChunk);

        // Update progress
        setProgress(prev => {
          const current = Math.min(i + chunkSize, totalItems);
          console.log(`Progress: ${current}/${totalItems}`);
          return { ...prev, current };
        });

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Filter out deleted items
      const activeProducts = newProducts.filter(p => !p.isDeleted);
      console.log("Processing complete, active products:", activeProducts.length);

      setProducts(activeProducts);
    } catch (err) {
      console.error("Error processing file:", err);
      setError("Error parsing Excel file. Please check the format.");
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
      console.log("File processing completed");
    }
  };

  //Use effect to log the updated state
  useEffect(() => {
    console.log("Products state in useEffect:", products);
  }, [products]);

  // Group products by their product group, handling null/undefined values
  //const categories = Array.from(new Set(products.map(p => p.item_id.substring(0,3) || 'Uncategorized')));

  const categories = useMemo(() => { // This is now the primary source of categories
      if (!products || products.length === 0) {
        return [];
      }

      const uniqueCategories = new Set<string>();

      products.forEach((product) => {
        const category = product.Product_Category;
        if (category) {
          uniqueCategories.add(category);
        }
      });

      return Array.from(uniqueCategories).sort();
    }, [products]);

    const filteredCategories = useMemo(() => {
      const searchTermLower = categorySearchTerm.toLowerCase();
      return categories.filter(category => category.toLowerCase().includes(searchTermLower));
    }, [categories, categorySearchTerm]);

    const vendors = useMemo(() => {
        if (!products || products.length === 0) {
          return [];
        }

        const uniqueVendors = new Set<string>();

        products.forEach((product) => {
          const vendor = product.Vendor_Name;
          if (vendor) { // Check if vendor exists
            uniqueVendors.add(vendor);
          }
        });

        return Array.from(uniqueVendors).sort(); // Sort vendors alphabetically
      }, [products]);

      const [selectedVendor, setSelectedVendor] = useState("All Vendors"); // New state

      const filteredVendors = useMemo(() => {
        const searchTermLower = vendorSearchTerm.toLowerCase();
        return vendors.filter(vendor => vendor.toLowerCase().includes(searchTermLower));
      }, [vendors, vendorSearchTerm]);


      const filteredProductsBeforeOtherFilters = useMemo(() => {
        return selectedCategory === "All Categories"
          ? products
          : products.filter(product => product.Product_Category === selectedCategory);
      }, [products, selectedCategory]);


      const searchedProducts = useMemo(() => { // Products filtered by general search term
        const searchTermLower = searchTerm.toLowerCase();
        return filteredProductsBeforeOtherFilters.filter(product => {
          const itemName = product.Product_Name;
          const itemSpecs = product.Product_Specs;
          const vendorName = product.Vendor_Name;
          const vendorProductNumber = product.Vendor_Product_Number;

          return (
            (itemName && itemName.toLowerCase().includes(searchTermLower)) ||
            (itemSpecs && itemSpecs.toLowerCase().includes(searchTermLower)) ||
            (vendorName && vendorName.toLowerCase().includes(searchTermLower)) ||
            (vendorProductNumber && vendorProductNumber.toLowerCase().includes(searchTermLower))
          );
        });
      }, [filteredProductsBeforeOtherFilters, searchTerm]);

const filteredProducts = useMemo(() => {
    const categoryFilter = selectedCategory === "All Categories" ? () => true : (product) => product.Product_Category === selectedCategory;
    const vendorFilter = selectedVendor === "All Vendors" ? () => true : (product) => product.Vendor_Name === selectedVendor;
    const searchTermLower = searchTerm.toLowerCase();

    return products
      .filter(categoryFilter) // Apply category filter FIRST
      .filter(vendorFilter)   // Apply vendor filter SECOND
      .filter(product => {     // Apply general search LAST
        const itemName = product.Product_Name;
        const itemSpecs = product.Product_Specs;
        const vendorName = product.Vendor_Name;
        const vendorProductNumber = product.Vendor_Product_Number;

        return (
          (itemName && itemName.toLowerCase().includes(searchTermLower)) ||
          (itemSpecs && itemSpecs.toLowerCase().includes(searchTermLower)) ||
          (vendorName && vendorName.toLowerCase().includes(searchTermLower)) ||
          (vendorProductNumber && vendorProductNumber.toLowerCase().includes(searchTermLower))
        );
      });
  }, [products, selectedCategory, selectedVendor, searchTerm]); // All dependencies are CRUCIAL

const totalPages = useMemo(() => { // Calculate totalPages based on filteredProducts
    return Math.ceil(filteredProducts.length / itemsPerPage);
  }, [filteredProducts, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]); // filteredProducts is the dependency


   const handleCategorySearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
              // Prevent form submission if inside a form
              event.preventDefault();
              // Trigger search or any other action you want on Enter
              setCurrentPage(1)
          }
      };

  const handleProductSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
          // Prevent form submission if inside a form
          event.preventDefault();
          // Trigger search or any other action you want on Enter
          setCurrentPage(1)
      }
  };

  const handleCategorySearchChange = (e) => {
      setCategorySearchTerm(e.target.value);
      setSelectedCategory("All Categories"); // Reset selected category here!
      setCurrentPage(1)
  };

  const handlePageChange = (page: number) => {
  setCurrentPage(page);
  };

  useEffect(() => {
      console.log("products:", products)
      console.log("categories:", categories)
      console.log("filteredCategories:", filteredCategories)
      console.log("filteredProducts:", filteredProducts)
      console.log("searchedProducts:", searchedProducts)
      console.log("paginatedProducts:", paginatedProducts)
  }, [products, categories, filteredProducts, searchedProducts, paginatedProducts])

const handleSendMessage = async () => {
    if (userInput.trim() === '') return; // Don't send empty messages

    setChatMessages(prevMessages => [...prevMessages, { role: 'user', content: userInput }]); // Add user message

    setUserInput(''); // Clear input field

    try {
        const prompt = `
            You are a helpful AI assistant for an inventory management system. You have access to product information across multiple vendors and categories.  Answer the user's question based on your knowledge of these products. If the question requires specific product details, ask clarifying questions to narrow down the search.  Be polite and professional.

            User: ${userInput}
        `;

        const apiKey = config.chatGptApiKey;

        if (!apiKey) {
            throw new Error("ChatGPT API key is missing. Check your config file.");
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // Or "gpt-4" if you have access
                messages: [{ role: "user", content: prompt }], // Use the prompt here
                max_tokens: 200,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`ChatGPT API error: ${response.status} - ${errorData.error.message}`);
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
            setChatMessages(prevMessages => [...prevMessages, { role: 'assistant', content: data.choices[0].message.content }]);
        } else {
            console.error("Unexpected ChatGPT API response:", data);
            setChatMessages(prevMessages => [...prevMessages, { role: 'assistant', content: "Error: Could not parse ChatGPT API response." }]);
        }

    } catch (error) {
        console.error("Error sending message:", error);
        setChatMessages(prevMessages => [...prevMessages, { role: 'assistant', content: `Error: ${error.message}` }]);
    }
};

useEffect(() => {
    // Scroll to bottom of chat container when new messages are added
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
}, [chatMessages]); // Scroll when chatMessages changes

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header (with product search) */}
      <header className="bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Menu className="h-6 w-6 cursor-pointer" />
              <h1 className="text-2xl font-bold">Inventory Management</h1>
            </div>
            <div className="flex-1 max-w-2xl mx-4">
              <div className="relative">
                  <input
                      type="text"
                      placeholder="Search inventory..."
                      className="w-full py-2 px-4 pr-10 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleProductSearchKeyDown} // Add onKeyDown handler
                  />
                  <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-500" />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <ShoppingCart className="h-6 w-6 cursor-pointer" />
              <button className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Upload Section */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="excel-upload" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
                <Upload className="h-5 w-5 mr-2" />
                <span>Upload Inventory Excel File</span>
              </label>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              {isLoading && (
                <div className="flex items-center space-x-3 mt-3">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <span className="text-sm text-gray-600">
                    Processing... {progress.current} of {progress.total} items
                  </span>
                  {progress.total > 0 && (
                    <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {products.length} items in inventory
            </div>
          </div>
        </div>
      </div>

{/* Categories (Dropdown and Search) */}
             <div className="bg-white shadow">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center space-x-4">
                        {/* Category Dropdown */}
                        <div className="relative w-64">
                            <select
                                value={selectedCategory}
                                onChange={(e) => {
                                    setSelectedCategory(e.target.value);
                                    setCurrentPage(1); // Reset page on category change
                                }}
                                className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="All Categories">All Categories</option>
                                {filteredCategories.map((category) => ( // Use filteredCategories here
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>

                        {/* Category Search */}
                        <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search Categories..."
                            value={categorySearchTerm}
                            onChange={handleCategorySearchChange}
                            onKeyDown={handleCategorySearchKeyDown}
                            className="w-full py-2 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        </div>
                    </div>
                </div>
            </div>

            {/* Vendor Dropdown */}
                  <div className="bg-white shadow">
                    <div className="container mx-auto px-4 py-3">
                      <div className="flex items-center space-x-4">
                        <div className="relative w-64">
                          <select
                            value={selectedVendor}
                            onChange={(e) => {
                              setSelectedVendor(e.target.value);
                              setCurrentPage(1); // Reset page if needed
                            }}
                            className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="All Vendors">All Vendors</option>
                            {filteredVendors.map((vendor) => (
                              <option key={vendor} value={vendor}>
                                {vendor}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"> {/* Added this div */}
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg> {/* SVG arrow */}
                          </div>
                        </div>

                        {/* Vendor Search (Optional - If you still want a search) */}
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Search Vendors..."
                            value={vendorSearchTerm}
                            onChange={(e) => setVendorSearchTerm(e.target.value)}
                            className="w-full py-2 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

            {/* View Toggle */}
            <div className="bg-white shadow">
              <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-end"> {/* Align to the right */}
                  <button
                    onClick={() => setIsGridView(!isGridView)}
                    className={`px-4 py-2 rounded-lg ${
                      isGridView ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isGridView ? 'Table View' : 'Grid View'}
                  </button>
                </div>
              </div>
            </div>


             {/* Main Content */}
              <main className="container mx-auto px-4 py-8">
                {isGridView ? ( // Conditional rendering for PRODUCT DISPLAY ONLY
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginatedProducts.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                      <div className="relative">
                        <img
                          src={product.Product_Image}
                          alt={product.Product_Name || 'Product Image'}
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            e.target.onerror = null; // Prevent infinite loop if the default image also fails
                            e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'; // Or a placeholder image URL
                          }}
                        />
                        <button className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow hover:bg-gray-100">
                          <Heart className="h-5 w-5 text-gray-600" />
                        </button>
                      </div>

                      <div className="p-4">
                        <h3 className="text-lg font-semibold mb-2">{product.Product_Name || 'No Name'}</h3>
                        <p className="text-gray-600 text-sm mb-2">{product.Product_Specs || 'No Specs'}</p>

                        <div className="mb-2">
                          <span className="text-sm text-gray-600">Vendor: {product.Vendor_Name || 'N/A'}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-sm text-gray-600">Product Number: {product.Vendor_Product_Number || 'N/A'}</span>
                        </div>

                        <div className="flex items-center justify-between mb-2"> {/* Added margin bottom for spacing */}
                          <div>
                            <span className="text-xl font-bold">
                              MSRP: {product.MSRP !== undefined ? `$${product.MSRP.toFixed(2)}` : 'Price N/A'}
                            </span>
                            {product.Dealer_Costs !== undefined && ( // Conditionally render Dealer Cost
                              <span className="text-gray-600 text-sm ml-2 line-through">
                               Dealer Costs: (${product.Dealer_Costs.toFixed(2)})
                              </span>
                            )}
                          </div>
                          <span className="text-gray-600">In Stock: {product['In Stock'] ? 'Yes' : 'No'}</span>
                        </div>
                          <div className="mt-2">
                          <a href={product['Product URL']} className="text-blue-500 hover:underline text-sm" target="_blank" rel="noopener noreferrer">
                            Product Page
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full border-collapse table-auto"> {/* Table View */}
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-4 py-2">Image</th>
                      <th className="border px-4 py-2">Product Name</th>
                      <th className="border px-4 py-2">Specs</th>
                      <th className="border px-4 py-2">Vendor</th>
                      <th className="border px-4 py-2">Product Number</th>
                      <th className="border px-4 py-2">MSRP</th>
                      <th className="border px-4 py-2">Dealer Cost</th>
                      <th className="border px-4 py-2">In Stock</th>
                      <th className="border px-4 py-2">Product URL</th>
                      {/* Add more table headers as needed */}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="border px-4 py-2">
                          <img
                            src={product.Product_Image}
                            alt={product.Product_Name || 'Product Image'}
                            className="w-20 h-20 object-cover" // Adjust image size as needed
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80';
                            }}
                          />
                        </td>
                        <td className="border px-4 py-2">{product.Product_Name || 'N/A'}</td>
                        <td className="border px-4 py-2">{product.Product_Specs || 'N/A'}</td>
                        <td className="border px-4 py-2">{product.Vendor_Name || 'N/A'}</td>
                        <td className="border px-4 py-2">{product.Vendor_Product_Number || 'N/A'}</td>
                        <td className="border px-4 py-2">
                          {product.MSRP !== undefined ? `$${product.MSRP.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="border px-4 py-2">
                          {product.Dealer_Costs !== undefined ? `$${product.Dealer_Costs.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="border px-4 py-2">
                          {product['In Stock'] ? 'Yes' : 'No'}
                        </td>
                        <td className="border px-4 py-2">
                            <a href={product['Product URL']} className="text-blue-500 hover:underline text-sm" target="_blank" rel="noopener noreferrer">
                              Product Page
                            </a>
                          </td>
                        {/* Add more table cells as needed */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
{/* Chatbot UI */}
        <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg p-4 overflow-y-auto max-h-96"> {/* Fixed position */}
            <div className="chat-container" ref={chatContainerRef}> {/* Added ref here */}
                {chatMessages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        <div className="message-content bg-gray-100 p-2 rounded-lg mb-2">
                            {message.content}
                        </div>
                    </div>
                ))}
            </div>
            <div className="chat-input flex mt-4">
                <input
                    type="text"
                    className="flex-grow border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }} // Send on Enter
                />
                <button
                    className="bg-blue-500 text-white rounded-md px-4 py-2 ml-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={handleSendMessage}
                >
                    Send
                </button>
            </div>
        </div>
     </main>

            <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginatedProducts.map((product) => ( // Use paginatedProducts here!
                        <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                            {/* ... product display JSX */}
                        </div>
                    ))}
                </div>
                {/* Pagination Controls */}
                 {totalPages > 1 && (
                    <div className="container mx-auto px-4 py-4 flex justify-center">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 mx-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                    >
                      Previous
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber = i + 1;

                      // Adjust page numbers based on current page to show a sliding window
                      if (totalPages > 5) {
                        if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                      }

                      return (
                        <React.Fragment key={pageNumber}>
                          {/* Show ellipsis if needed */}
                          {i === 0 && pageNumber > 1 && totalPages > 5 && <span className="px-2 py-2">...</span>}

                          <button
                            onClick={() => handlePageChange(pageNumber)}
                            className={`px-4 py-2 mx-1 rounded ${
                              currentPage === pageNumber ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            {pageNumber}
                          </button>

                          {/* Show ellipsis if needed */}
                          {i === Math.min(4, totalPages - 1) && pageNumber < totalPages && totalPages > 5 && <span className="px-2 py-2">...</span>}
                        </React.Fragment>
                      );
                    })}

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 mx-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  )}
            </main>
      </div>
    );
  }

export default App;