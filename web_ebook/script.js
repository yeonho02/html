// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('pdf-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const loadingContainer = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const progressBar = document.getElementById('progress');
    const bookArea = document.getElementById('book-area');
    const bookContainer = document.getElementById('book');
    const headerPanel = document.querySelector('header');
    
    // Controls
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    
    let pageFlip = null;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== "application/pdf") {
            alert("Please select a valid PDF file.");
            return;
        }

        fileNameDisplay.textContent = file.name;
        
        // Reset everything
        if (pageFlip) {
            pageFlip.destroy();
            pageFlip = null;
        }
        bookContainer.innerHTML = '';
        bookArea.style.display = 'none';
        
        loadingContainer.style.display = 'flex';
        progressBar.style.width = '0%';
        loadingText.textContent = "Loading PDF...";

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdf.numPages;
            
            loadingText.textContent = `Rendering ${totalPages} pages...`;
            
            // Render first page to determine dimensions
            const page1 = await pdf.getPage(1);
            // Higher scale for better resolution
            const viewport1 = page1.getViewport({ scale: 1.5 });
            
            const bookWidth = viewport1.width;
            const bookHeight = viewport1.height;
            
            const htmlPages = [];
            
            // Add Hard Covers
            // Front cover
            let coverFrontHTML = `
                <div class="page hard" data-density="hard">
                    <div class="page-content" style="background:#0f172a; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding: 2rem; text-align:center;">
                        <h2 style="font-family:'Outfit'; font-size:2rem; margin-bottom:1rem; background: linear-gradient(135deg, #60a5fa, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: transparent; word-break: break-word;">${file.name}</h2>
                        <p style="opacity:0.7; font-family:'Inter'; font-weight: 300;">Drag corner or click edge to open</p>
                    </div>
                </div>
                <!-- Inside front cover (blank) -->
                <div class="page hard" data-density="hard">
                    <div class="page-content" style="background-color:#1e293b;"></div>
                </div>
            `;
            htmlPages.push(coverFrontHTML);

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                
                await page.render(renderContext).promise;
                
                // Convert to compressed jpeg image data
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                
                htmlPages.push(`
                    <div class="page">
                        <div class="page-content" style="background-image: url('${imgData}');"></div>
                    </div>
                `);

                const progressPercentage = (pageNum / totalPages) * 100;
                progressBar.style.width = `${progressPercentage}%`;
            }
            
            // If total inner pages is odd, add a blank page so that the back cover is correctly on the right
            if (totalPages % 2 !== 0) {
                 htmlPages.push(`
                    <div class="page">
                        <div class="page-content" style="background-color:#ffffff;"></div>
                    </div>
                `);
            }
            
            // Back cover
            let coverBackHTML = `
                <!-- Inside back cover (blank) -->
                <div class="page hard" data-density="hard">
                    <div class="page-content" style="background-color:#1e293b;"></div>
                </div>
                <div class="page hard" data-density="hard">
                    <div class="page-content" style="background:#0f172a; display:flex; align-items:center; justify-content:center; color:white;">
                        <h2 style="font-family:'Outfit'; opacity:0.5;">The End</h2>
                    </div>
                </div>
            `;
            htmlPages.push(coverBackHTML);

            bookContainer.innerHTML = htmlPages.join('');

            loadingContainer.style.display = 'none';
            bookArea.style.display = 'flex';
            
            // Establish base sizes for calculation (not max display bounds because size 'stretch' upscales it)
            // Capping at 450 prevents PageFlip from erroneously forcing 'portrait' mode on wide screens
            let finalWidth = Math.min(bookWidth, 450); 
            let finalHeight = Math.round((finalWidth / bookWidth) * bookHeight);
            finalWidth = Math.round(finalWidth);
            
            pageFlip = new St.PageFlip(bookContainer, {
                width: finalWidth,
                height: finalHeight,
                size: "stretch", // Stretches proportionally up to maxWidth/maxHeight constraints
                minWidth: 300,
                maxWidth: 1600,
                minHeight: 400,
                maxHeight: 2000,
                maxShadowOpacity: 0.5,
                showCover: true,
                mobileScrollSupport: false,
                usePortrait: window.innerWidth < 800 // Only switch to single page portrait mode on actual mobile
            });
            
            // Only select pages belonging to THIS instantiated viewer
            pageFlip.loadFromHTML(bookContainer.querySelectorAll('.page'));

            pageFlip.on('flip', (e) => {
                updatePageInfo(e.data, totalPages);
            });
            
            prevBtn.onclick = () => {
                if (pageFlip) pageFlip.flipPrev();
            };
            
            nextBtn.onclick = () => {
                if (pageFlip) pageFlip.flipNext();
            };
            
            updatePageInfo(0, totalPages);

        } catch (error) {
            console.error(error);
            alert("Error parsing PDF: " + error.message + "\n\n" + (error.stack ? error.stack : ""));
            loadingContainer.style.display = 'none';
        }
    });
    
    function updatePageInfo(currentPageIndex, totalPdfPages) {
        let displayStr = "";
        
        // Page index maps to:
        // 0: Front Cover
        // 1: Inside Front Cover (blank)
        // 2 to (2 + totalPdfPages - 1): PDF contents
        // Following are blank filler (if any) and back covers.
        
        if (currentPageIndex === 0) {
            displayStr = "Front Cover";
        } else if (currentPageIndex >= 2 && currentPageIndex < 2 + totalPdfPages) {
            // Simplified display focusing on current actual PDF page number equivalent
            let pdfPageNum = currentPageIndex - 1;
            displayStr = `Page ${pdfPageNum} of ${totalPdfPages}`;
        } else {
            displayStr = "Back Cover / End";
        }
        
        pageInfo.textContent = displayStr;
    }
});
