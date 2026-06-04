import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.0.227/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="flex items-center justify-between p-3 bg-gray-50 border-b">
        <h3 class="font-semibold text-gray-800">PDF Preview</h3>
        <div class="flex items-center gap-2">
          <button class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                  [disabled]="currentPage <= 1" (click)="prevPage()">
            Previous
          </button>
          <span class="text-sm text-gray-600">Page {{ currentPage }} / {{ totalPages || '?' }}</span>
          <button class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                  [disabled]="currentPage >= totalPages" (click)="nextPage()">
            Next
          </button>
        </div>
      </div>
      <div class="flex items-center justify-center p-4 bg-gray-100 min-h-[500px]">
        <canvas #pdfCanvas class="max-w-full shadow-lg rounded"></canvas>
        <div *ngIf="!totalPages" class="text-gray-400 text-center">
          <span class="material-icons text-6xl mb-2">picture_as_pdf</span>
          <p>PDF preview not available</p>
        </div>
      </div>
    </div>
  `,
})
export class PdfViewerComponent implements OnChanges {
  @Input() pdfUrl: string | null = null;

  currentPage = 1;
  totalPages = 0;
  private pdfDoc: any = null;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pdfUrl'] && this.pdfUrl) {
      this.loadPdf();
    }
  }

  async loadPdf(): Promise<void> {
    try {
      this.pdfDoc = await pdfjsLib.getDocument(this.pdfUrl!).promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      this.renderPage();
    } catch (err) {
      console.error('PDF load error:', err);
    }
  }

  async renderPage(): Promise<void> {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(this.currentPage);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  prevPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.renderPage();
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.renderPage();
  }
}
