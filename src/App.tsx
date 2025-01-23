import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, Menu, Star, Heart, Upload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// Product type definition with updated fields
interface Product {
  id: number;
  inv_mast_uid?: string;        // Inventory Master UID
  item_id?: string;             // Item ID
  Item_description?: string;    // Item Description
  Extended_Description?: string; // Extended Description
  Delete_Flag?: boolean;        // Delete Flag
  discontinued?: boolean;       // Discontinued
  Sales_Pricing_unit?: string;  // Sales Pricing Unit
  Location_ID?: string;         // Location ID
  Qty_On_Hand?: number;         // Quantity On Hand
  Qty_On_Allocated?: number;    // Quantity Allocated
  Product_Group_Description?: string; // Product Group Description
  Cost?: number;                // Cost
  List_Price?: number;          // List Price
  Class_ID5?: string;           // Class ID 5
  upc_code?: string;            // UPC Code
  weight?: number;              // Weight
  cube?: number;                // Cube
  Supplier_Name?: string;       // Supplier Name
  Image?: string;               // Image
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

        let itemId = row.item_id;
        // Data cleaning and type handling for itemId
        if (typeof itemId === 'number') {
          itemId = String(itemId); // Convert numbers to strings
        } else if (typeof itemId !== 'string' && itemId !== null && itemId !== undefined) {
          console.warn("Unexpected item_id type:", typeof itemId, itemId);
          itemId = 'Uncategorized';
        } else if (itemId === null || itemId === undefined){
            itemId = 'Uncategorized'
        }

        let cost = row.Cost
        if (typeof cost === 'string'){
            cost = parseFloat(cost)
        }else if(typeof cost !== 'number' && cost !== null && cost !== undefined){
            console.warn("Unexpected Cost type:", typeof cost, cost)
            cost = undefined
        }

        return{
          id: i + index + 1,
          inv_mast_uid: row.inv_mast_uid,
          item_id: itemId,
          Item_description: row.Item_description,
          Extended_Description: row.Extended_Description,
          Delete_Flag: row.Delete_Flag === 'y',
          discontinued: row.discontinued === 'y',
          Sales_Pricing_unit: row.Sales_Pricing_unit,
          Location_ID: row.Location_ID,
          Qty_On_Hand: row.Qty_On_Hand ? parseFloat(row.Qty_On_Hand) : undefined,
          Qty_On_Allocated: row.Qty_On_Allocated ? parseFloat(row.Qty_On_Allocated) : undefined,
          Product_Group_Description: row.Product_Group_Description,
          Cost: cost,
          List_Price: row.List_Price ? parseFloat(row.List_Price) : undefined,
          Class_ID5: row.Class_ID5,
          upc_code: row.upc_code,
          weight: row.weight ? parseFloat(row.weight) : undefined,
          cube: row.cube ? parseFloat(row.cube) : undefined,
          Supplier_Name: row.Supplier_Name,
          Image: row.Image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'
        }});

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

  const categories = useMemo(() => {
      if (!products || products.length === 0) {
          return []; // Return empty array if products is null or empty
      }
      return Array.from(
          new Set(
              products.map((p) => {
                  const itemId = p.item_id;
                  if (typeof itemId === 'string') {
                      return itemId.substring(0, 3);
                  } else if (itemId === null || itemId === undefined) {
                      return 'Uncategorized'; // Handle null or undefined explicitly
                  } else {
                      console.warn(`Unexpected item_id type: ${typeof itemId}. Value:`, itemId); // Log unexpected types
                      return 'Uncategorized';  // Provide a default category
                  }
              })
          )
      );
  }, [products]); // Add products as a dependency

    const allCategories = useMemo(() => {
        if (!products || products.length === 0) {
            return [];
        }
        return Array.from(
            new Set(
                products.map((p) => {
                    const itemId = p.item_id;
                    return typeof itemId === 'string' ? itemId.substring(0, 3) : 'Uncategorized';
                })
            )
        );
    }, [products]);

    // Calculate filteredCategories *inside* the component function
    const filteredCategories = useMemo(() => {
        return allCategories.filter(category =>
            category.toLowerCase().includes(categorySearchTerm.toLowerCase())
        );
    }, [allCategories, categorySearchTerm]); //Add dependencies

    const filteredProducts = useMemo(() => {
        return selectedCategory === "All Categories"
            ? products
            : products.filter(product => {
                const itemId = product.item_id;
                return typeof itemId === 'string' && itemId.startsWith(selectedCategory);
            });
    }, [products, selectedCategory]);

    const searchedProducts = useMemo(() => {
        return searchTerm
            ? filteredProducts.filter(product =>
                product.Item_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.Extended_Description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.Supplier_Name?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            : filteredProducts;
    }, [filteredProducts, searchTerm]);

    const totalPages = Math.ceil(searchedProducts.length / itemsPerPage);
    const paginatedProducts = useMemo(() => {
        return searchedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [searchedProducts, currentPage]);

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
      console.log("allCategories:", allCategories)
      console.log("filteredCategories:", filteredCategories)
      console.log("filteredProducts:", filteredProducts)
      console.log("searchedProducts:", searchedProducts)
      console.log("paginatedProducts:", paginatedProducts)
  }, [products, allCategories, filteredCategories, filteredProducts, searchedProducts, paginatedProducts])


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
                                {filteredCategories.map((category) => (
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
                                onChange={handleCategorySearchChange} // Use the new handler
                                onKeyDown={handleCategorySearchKeyDown}
                                className="w-full py-2 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedProducts
            .map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="relative">
                  <img
                    src={product.Image}
                    alt={product.Item_description || 'Product Image'}
                    className="w-full h-48 object-cover"
                  />
                  <button className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow hover:bg-gray-100">
                    <Heart className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
                
                <div className="p-4">
                  {product.supplierName && (
                    <div className="text-sm text-gray-600 mb-1">{product.supplierName}</div>
                  )}
                  <h3 className="text-lg font-semibold mb-2">{product.Item_description || 'No Description'}</h3>
                  {product.Extended_Description && (
                    <p className="text-gray-600 text-sm mb-2">{product.Extended_Description}</p>
                  )}
                  
                  {product.inv_mast_uid && (
                    <div className="flex items-center mb-2">
                      <span className="text-sm text-gray-600">inv_mast_uid: {product.inv_mast_uid}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold">
                      {product.Cost !== undefined ? `$${product.Cost}` : 'Price N/A'}
                    </span>
                    <div className="text-sm text-gray-600">
                      Pricing Unit: {product.Sales_Pricing_unit ? ` ${product.Sales_Pricing_unit}` : ''}
                    </div>
                    <div className="text-sm text-gray-600">
                      Stock: {product.Qty_On_Hand !== undefined ? product.Qty_On_Hand : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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