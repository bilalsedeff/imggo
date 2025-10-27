import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.join(process.cwd(), 'public');
const logoDir = path.join(publicDir, 'LogotypeVert[1]');
const whiteDir = path.join(publicDir, 'white');

// SVG dosyalarını beyaza çevir
async function convertSvgToWhite(inputPath: string, outputPath: string) {
  let svgContent = fs.readFileSync(inputPath, 'utf-8');
  
  // Tüm path elementlerine fill="white" ekle
  svgContent = svgContent.replace(/<path/g, '<path fill="white"');
  svgContent = svgContent.replace(/<rect/g, '<rect fill="white"');
  svgContent = svgContent.replace(/<circle/g, '<circle fill="white"');
  svgContent = svgContent.replace(/<ellipse/g, '<ellipse fill="white"');
  svgContent = svgContent.replace(/<polygon/g, '<polygon fill="white"');
  
  fs.writeFileSync(outputPath, svgContent);
  console.log(`✓ SVG converted: ${path.basename(outputPath)}`);
}

// PNG dosyalarını beyaza çevir (siyah -> beyaz)
async function convertPngToWhite(inputPath: string, outputPath: string) {
  try {
    await sharp(inputPath)
      .negate() // Renkleri tersine çevir
      .toFile(outputPath);
    console.log(`✓ PNG converted: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ Error converting ${path.basename(inputPath)}:`, error);
  }
}

async function main() {
  console.log('🎨 Converting logos to white versions...\n');
  
  // Logo.svg dosyasını çevir
  const logoSvgPath = path.join(publicDir, 'logo.svg');
  if (fs.existsSync(logoSvgPath)) {
    await convertSvgToWhite(logoSvgPath, path.join(whiteDir, 'logo.svg'));
  }
  
  // LogotypeVert[1] klasöründeki dosyaları çevir
  const files = fs.readdirSync(logoDir);
  
  for (const file of files) {
    const inputPath = path.join(logoDir, file);
    const outputPath = path.join(whiteDir, file);
    
    if (file.endsWith('.svg')) {
      await convertSvgToWhite(inputPath, outputPath);
    } else if (file.endsWith('.png')) {
      await convertPngToWhite(inputPath, outputPath);
    }
  }
  
  console.log('\n✨ All logos converted successfully!');
}

main().catch(console.error);
