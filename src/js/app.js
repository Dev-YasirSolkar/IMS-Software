// Frontend JavaScript logic
// Note: This script interacts with Electron's IPC API (window.electronAPI)
// File operations will not work if index.html is opened directly in a browser.

let products = []; // Array to hold product data

// --- Helper Functions ---

function formatCurrency(amount) {
    // Format as Indian Rupees (INR)
    return `₹${parseFloat(amount).toFixed(2)}`;
}

function generateUniqueId() {
    // Simple unique ID based on timestamp and random number
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Function to get the full path for displaying an image stored locally
// This uses IPC to get the application's user data path and constructs a file:// URL.
async function getLocalImagePathForDisplay(relativePath) {
    if (!relativePath || !window.electronAPI || typeof window.electronAPI.getImsDataPath !== 'function') {
         // Fallback to placeholder if Electron API or getImsDataPath is not available
         console.warn("Electron API or getImsDataPath not available for image display.");
         return 'https://placehold.co/50x50/e2e8f0/a0aec0?text=No+Image';
    }

    try {
        const imsDataPath = await window.electronAPI.getImsDataPath();
        const fullPath = path.join(imsDataPath, relativePath);
        // Use file:// protocol to access local files in the renderer
        // Note: path module is available in the preload script and exposed via electronAPI if needed in renderer
        // For constructing file:// URLs, `path.join` is generally safe in renderer if base path is trusted.
        return `file://${fullPath.replace(/\\/g, '/')}`; // Replace backslashes for URL compatibility on Windows
    } catch (error) {
        console.error("Error getting IMS data path for image display:", error);
        return 'https://placehold.co/50x50/e2e8f0/a0aec0?text=Error'; // Error placeholder
    }
}


// --- Data Loading and Saving (via Electron IPC) ---

async function loadProducts() {
    // Check if electronAPI is available (i.e., running in Electron)
    if (window.electronAPI) {
        const result = await window.electronAPI.loadData('products');
        if (result.success) {
            products = result.data;
            console.log("Products loaded:", products);
        } else {
            console.error("Failed to load products:", result.error);
            products = []; // Start with empty array on error
        }
    } else {
        console.warn("Running in browser mode. Cannot load data from files.");
        products = []; // Empty data in browser mode
        // In a real browser app, you might load from localStorage here (limited)
    }
    renderProducts(); // Always render after attempting to load
}

async function saveProducts() {
    if (window.electronAPI) {
        const result = await window.electronAPI.saveData('products', products);
        if (result.success) {
            console.log("Products saved successfully.");
        } else {
            console.error("Failed to save products:", result.error);
             // Use a more user-friendly notification than alert in a real app
            alert(`Error saving products: ${result.error}`);
        }
    } else {
        console.warn("Running in browser mode. Cannot save data to files.");
        alert("Saving is not supported when opening index.html directly in a browser.");
    }
}

// --- UI Rendering ---

async function renderProducts() {
    const tableBody = document.getElementById('products-table-body');
    tableBody.innerHTML = ''; // Clear existing rows

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No products added yet.</td></tr>';
        return;
    }

    // Use Promise.all to wait for all image path resolutions before rendering
    const productRows = await Promise.all(products.map(async product => {
        // Resolve image path for display using the async function
        const imageSrc = product.imagePath
            ? await getLocalImagePathForDisplay(product.imagePath)
            : 'https://placehold.co/50x50/e2e8f0/a0aec0?text=No+Image'; // Placeholder

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <img src="${imageSrc}" alt="${product.name || 'Product'} Image" class="product-image-thumb">
                </td>
                <td class="px-6 py-4 whitespace-nowrap">${product.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${product.sku || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">${formatCurrency(product.price)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${product.stock}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-2 edit-btn" data-id="${product.id}">Edit</button>
                    <button class="text-red-600 hover:text-red-900 delete-btn" data-id="${product.id}">Delete</button>
                </td>
            </tr>
        `;
    }));

    tableBody.innerHTML = productRows.join(''); // Add all rows to the table

    // Add event listeners to the new buttons AFTER they are added to the DOM
    tableBody.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', handleEditProduct);
    });
     tableBody.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteProduct);
    });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(`${viewId}-view`).classList.remove('hidden');

     // Update active button style (basic example)
     document.querySelectorAll('.view-btn').forEach(btn => {
         if (btn.getAttribute('data-view') === viewId) {
             btn.classList.remove('bg-gray-300', 'text-gray-800');
             btn.classList.add('bg-blue-500', 'text-white');
         } else {
             btn.classList.remove('bg-blue-500', 'text-white');
             btn.classList.add('bg-gray-300', 'text-gray-800');
         }
     });

    // Load data specific to the view if needed
    if (viewId === 'products') {
        loadProducts(); // Reload products when viewing the products tab
    }
    // Add logic for other views here
}


// --- Event Handlers ---

function handleAddProductClick() {
    const formContainer = document.getElementById('product-form-container');
    const formTitle = document.getElementById('product-form-title');
    const productForm = document.getElementById('product-form');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const productImagePathInput = document.getElementById('product-image-path');

    formContainer.classList.remove('hidden');
    formTitle.textContent = 'Add New Product';
    productForm.reset(); // Clear form fields
    document.getElementById('product-id').value = ''; // Clear hidden ID
    productImagePathInput.value = ''; // Clear image path
    imagePreview.classList.add('hidden'); // Hide preview
    imagePreview.src = ''; // Clear preview source
    removeImageBtn.classList.add('hidden'); // Hide remove button
     console.log("Showing Add Product form.");
}

function handleCancelProductFormClick() {
     document.getElementById('product-form-container').classList.add('hidden');
     document.getElementById('product-form').reset();
     // Also clear image preview and path
     document.getElementById('image-preview').classList.add('hidden');
     document.getElementById('image-preview').src = '';
     document.getElementById('remove-image-btn').classList.add('hidden');
     document.getElementById('product-image-path').value = '';
     console.log("Canceled Product form.");
}


async function handleProductFormSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const sku = document.getElementById('product-sku').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value, 10);
    const imagePath = document.getElementById('product-image-path').value; // Get the saved image path

    // Basic validation for price and stock number inputs
    if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
        alert('Please fill in all required fields with valid numbers for price and stock.');
        return;
    }

    if (id) {
        // Editing existing product
        console.log(`Saving existing product with ID: ${id}`);
        const productIndex = products.findIndex(p => p.id === id);
        if (productIndex > -1) {
            products[productIndex] = { ...products[productIndex], id, name, sku, price, stock, imagePath }; // Include imagePath
             console.log("Updated product in array:", products[productIndex]);
        } else {
             console.error(`Product with ID ${id} not found for editing.`);
             alert("Error: Product not found for saving.");
             return; // Stop if product not found
        }
    } else {
        // Adding new product
        const newProduct = {
            id: generateUniqueId(), // Generate a new unique ID
            name,
            sku,
            price,
            stock,
            imagePath // Include imagePath
        };
        products.push(newProduct);
         console.log("Added new product:", newProduct);
    }

    await saveProducts(); // Save the updated products array
    renderProducts(); // Re-render the product list
    document.getElementById('product-form-container').classList.add('hidden'); // Hide the form
    document.getElementById('product-form').reset(); // Reset the form
     // Clear image preview and path after saving
     document.getElementById('image-preview').classList.add('hidden');
     document.getElementById('image-preview').src = '';
     document.getElementById('remove-image-btn').classList.add('hidden');
     document.getElementById('product-image-path').value = '';
     console.log("Product form submitted and saved.");
}

async function handleEditProduct(event) {
    const productId = event.target.getAttribute('data-id');
    console.log(`Attempting to edit product with ID: ${productId}`);
    const productToEdit = products.find(p => p.id === productId);
    const formContainer = document.getElementById('product-form-container');
    const formTitle = document.getElementById('product-form-title');
    const productForm = document.getElementById('product-form');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const productImagePathInput = document.getElementById('product-image-path');


    if (productToEdit) {
        console.log("Product found for editing:", productToEdit);
        formContainer.classList.remove('hidden');
        formTitle.textContent = 'Edit Product';

        // Populate the form with product data
        document.getElementById('product-id').value = productToEdit.id;
        document.getElementById('product-name').value = productToEdit.name;
        document.getElementById('product-sku').value = productToEdit.sku;
        document.getElementById('product-price').value = productToEdit.price;
        document.getElementById('product-stock').value = productToEdit.stock;
        productImagePathInput.value = productToEdit.imagePath || ''; // Populate image path

        // Display image preview if path exists
        if (productToEdit.imagePath) {
             // Get the full path for display using the async function
             const imageSrc = await getLocalImagePathForDisplay(productToEdit.imagePath);
             imagePreview.src = imageSrc;
             imagePreview.classList.remove('hidden');
             removeImageBtn.classList.remove('hidden');
             console.log("Displaying image preview from path:", imageSrc);
        } else {
             imagePreview.classList.add('hidden');
             imagePreview.src = '';
             removeImageBtn.classList.add('hidden');
             console.log("No image path found for product, hiding preview.");
        }
    } else {
        console.error(`Product with ID ${productId} not found for editing.`);
        alert("Error: Product not found.");
    }
}

async function handleDeleteProduct(event) {
    const productId = event.target.getAttribute('data-id');
    console.log(`Attempting to delete product with ID: ${productId}`);
    // Ask for confirmation before deleting
    if (confirm('Are you sure you want to delete this product?')) {
        // Optional: Delete the associated image file if it exists
        const productToDelete = products.find(p => p.id === productId);
        if (productToDelete && productToDelete.imagePath && window.electronAPI && typeof window.electronAPI.deleteFile === 'function') {
             // This would require an IPC handler to delete the file in the main process
             // For simplicity in this basic example, we won't delete the file yet.
             // A real app should implement this via IPC for cleanup.
             console.log(`Would delete image file: ${productToDelete.imagePath}`);
             // await window.electronAPI.deleteFile(productToDelete.imagePath); // Example call if deleteFile IPC existed
        } else {
             console.log("No image file to delete or deleteFile IPC not available.");
        }


        products = products.filter(p => p.id !== productId); // Remove the product
        await saveProducts(); // Save the updated list
        renderProducts(); // Re-render the list
        console.log(`Product with ID ${productId} deleted.`);
    } else {
        console.log(`Deletion of product with ID ${productId} canceled.`);
    }
}

// Image Upload Handling
async function handleImageUploadClick() {
    if (!window.electronAPI) {
        alert("Image upload is only supported in the Electron application.");
        console.warn("Attempted image upload in browser mode.");
        return;
    }

    console.log("Opening image selection dialog...");
    const result = await window.electronAPI.selectImage();

    if (result.success) {
        const originalPath = result.filePath;
        console.log("Image selected:", originalPath);
        // Now copy the file to the data directory
        console.log("Copying image to data directory...");
        const copyResult = await window.electronAPI.copyImageToData(originalPath);

        if (copyResult.success) {
            const relativePath = copyResult.relativePath;
            document.getElementById('product-image-path').value = relativePath; // Store the relative path

            // Display the preview using the resolved path from the data directory
             const imageSrc = await getLocalImagePathForDisplay(relativePath);
             document.getElementById('image-preview').src = imageSrc;
             document.getElementById('image-preview').classList.remove('hidden');
             document.getElementById('remove-image-btn').classList.remove('hidden');

            console.log("Image saved to data directory:", relativePath);

        } else {
            console.error("Failed to copy image:", copyResult.error);
            alert(`Error saving image: ${copyResult.error}`);
        }
    } else {
        console.log(result.message); // Log cancellation message
    }
}

function handleRemoveImageClick() {
    document.getElementById('product-image-path').value = ''; // Clear the saved path
    document.getElementById('image-preview').classList.add('hidden'); // Hide preview
    document.getElementById('image-preview').src = ''; // Clear preview source
    document.getElementById('remove-image-btn').classList.add('hidden'); // Hide remove button
     console.log("Removed image path from form.");
     // Note: This does NOT delete the actual file from the data directory.
     // A real app might implement file deletion via IPC here for cleanup.
}


// --- Initial Load and Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for navigation buttons
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const viewId = event.target.getAttribute('data-view');
            showView(viewId);
        });
    });

    // Add event listeners for Product Management
    document.getElementById('add-product-btn').addEventListener('click', handleAddProductClick);
    document.getElementById('cancel-product-form-btn').addEventListener('click', handleCancelProductFormClick);
    document.getElementById('product-form').addEventListener('submit', handleProductFormSubmit);

    // Add event listeners for Image Upload
    // Clicking the area triggers the file selection dialog via IPC
    document.getElementById('image-upload-area').addEventListener('click', handleImageUploadClick);

    // Add event listener for Remove Image button
    document.getElementById('remove-image-btn').addEventListener('click', handleRemoveImageClick);


    // Initially show the products view and load data
    showView('products');
});

