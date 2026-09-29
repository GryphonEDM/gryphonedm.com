// Maximum distance for xy displacement offset
var DRIFT_RANGE = 25;

// Create/cache canvases and contexts for source image, 
// displacement map, and output
var cOutput = document.getElementById('output'),
    ctxOutput = cOutput.getContext('2d'),

    cSource = document.createElement('canvas'),
    ctxSource = cSource.getContext('2d'),

    cMap = document.createElement('canvas'),
    ctxMap = cMap.getContext('2d'),

    images = document.querySelectorAll('#images img');

// Ensure all canvases are the same size
var cw = cSource.width = cMap.width = cOutput.width;
var ch = cSource.height = cMap.height = cOutput.height;

// Refs for the image data
var sourceData, mapData,
    outputData = ctxOutput.createImageData(cw, ch);

function update() {
    // Calculate the xy drift based on the current time.
    // y drift is half-speed
    // TODO: make interactive (mouse, gyro, etc)
    var t = 0.002 * Date.now(),
        dx = Math.sin(t) * DRIFT_RANGE,
        dy = Math.cos(t * 0.5) * DRIFT_RANGE;

    // Iterate the xy grid
    // TODO: optimize this!
    for (var y = 0; y < ch; y++) {
        for (var x = 0; x < cw; x++) {

            // Get the greyscale value from the displacement map as a value between 0 and 1
            // 0 = black (farthest), 1 = white (nearest)
            // Higher values will be more displaced
            var pix = y * cw + x,
                arrayPos = pix * 4,
                depth = mapData[arrayPos] / 255;

            // Use the greyscale value as a percentage of our current drift,
            // and calculate an xy pixel offset based on that
            var ofs_x = Math.round(x + (dx * depth)),
                ofs_y = Math.round(y + (dy * depth));

            // Clamp the offset to the canvas dimensions
            if (ofs_x < 0) ofs_x = 0;
            if (ofs_x > cw - 1) ofs_x = cw - 1;
            if (ofs_y < 0) ofs_y = 0;
            if (ofs_y > ch - 1) ofs_y = ch - 1;

            // Get the colour from the source image at the offset xy position,
            // and transfer it to our output at the original xy position
            var targetPix = ofs_y * cw + ofs_x,
                targetPos = targetPix * 4;
            outputData.data[arrayPos] = sourceData[targetPos];
            outputData.data[arrayPos + 1] = sourceData[targetPos + 1];
            outputData.data[arrayPos + 2] = sourceData[targetPos + 2];
            outputData.data[arrayPos + 3] = sourceData[targetPos + 3];
        }
    }
}

function render() {
    ctxOutput.putImageData(outputData, 0, 0);
}

function loop() {
    requestAnimationFrame(loop);
    // The mandala replaces the logo in mandala mode; skip the per-pixel work while it's hidden
    if (document.body.classList.contains('mode-mandala')) return;
    update();
    render();
}

function init() {
    // Write our source image and displacement map to in-memory
    // canvases and cache the data (it never gets directly manipulated)

    var sourceImg = images[0],
        mapImg = images[1];

    ctxSource.drawImage(sourceImg, 0, 0);
    sourceData = ctxSource.getImageData(0, 0, cw, ch).data;

    ctxMap.drawImage(mapImg, 0, 0);
    mapData = ctxMap.getImageData(0, 0, cw, ch).data;

    console.log('Source and map data cached');

    // Kick off the update-render loop
    loop();
}

// Wait for images to load before starting
imagesLoaded(images, function() {
    console.log('Images loaded');
    console.log('Number of images found:', images.length);
    for (var i = 0; i < images.length; i++) {
        console.log('Image ' + i + ' src:', images[i].src);
        console.log('Image ' + i + ' complete:', images[i].complete);
    }
    init();
});

// Mobile detection function
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check for mobile devices
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobile = mobileRegex.test(userAgent.toLowerCase());
    
    // Additional check for screen size
    const isSmallScreen = window.innerWidth <= 768;
    
    return isMobile || isSmallScreen;
}

// Function to show/hide mobile UI elements
function toggleMobileUI() {
    const mobileElements = document.querySelectorAll('.mobile-only, .mobile-header-section');
    const isMobile = isMobileDevice();
    
    mobileElements.forEach(element => {
        if (isMobile) {
            element.style.display = element.classList.contains('mobile-header-section') ? 'block' : 'flex';
        } else {
            element.style.display = 'none';
        }
    });
    
    console.log('Mobile device detected:', isMobile);
    console.log('Mobile UI elements:', mobileElements.length);
}

// Set animation delays for rainbow letters and handle mobile UI
document.addEventListener('DOMContentLoaded', function() {
    const letters = document.querySelectorAll('.rainbow-letter');
    letters.forEach(letter => {
        const index = parseInt(letter.getAttribute('data-index'));
        letter.style.setProperty('--index', index);
    });
    
    // Initialize mobile UI
    toggleMobileUI();
    
    // Handle window resize
    window.addEventListener('resize', toggleMobileUI);
}); 