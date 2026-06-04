import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../core/http/api.service';
import type { SlideData, SlidesResponse } from '../shared/models/types';

@Component({
  selector: 'app-pptx-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="flex items-center justify-between p-3 bg-gray-50 border-b">
        <h3 class="font-semibold text-gray-800">PPTX Preview</h3>
        <div class="flex items-center gap-2">
          <button class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                  [disabled]="currentSlide <= 0" (click)="prevSlide()">
            Previous
          </button>
          <span class="text-sm text-gray-600">Slide {{ currentSlide + 1 }} / {{ slides.length || '?' }}</span>
          <button class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                  [disabled]="currentSlide >= slides.length - 1" (click)="nextSlide()">
            Next
          </button>
        </div>
      </div>

      <div class="p-4 bg-gray-100 min-h-[500px]">
        <!-- Loading -->
        <div *ngIf="loading" class="flex items-center justify-center h-[500px]">
          <div class="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
        </div>

        <!-- Error -->
        <div *ngIf="error" class="flex flex-col items-center justify-center h-[500px] text-red-400">
          <span class="material-icons text-6xl mb-2">error</span>
          <p>{{ error }}</p>
        </div>

        <!-- Slide display -->
        <div *ngIf="!loading && !error && currentSlideData" class="max-w-4xl mx-auto">
          <div class="bg-white rounded-lg shadow-lg overflow-hidden"
               [style.aspect-ratio]="slideAspectRatio">
            <div class="p-6 h-full overflow-auto">
              <div *ngFor="let shape of currentSlideData.shapes" class="mb-3">
                <!-- Title -->
                <h2 *ngIf="shape.is_title" class="text-2xl font-bold mb-4"
                    [style.color]="shape.font_color"
                    [style.text-align]="shape.alignment">
                  {{ shape.text }}
                </h2>
                <!-- Text shape -->
                <div *ngIf="!shape.is_title && shape.text && !shape.table_data"
                     [style.color]="shape.font_color"
                     [style.font-size.px]="shape.font_size"
                     [style.font-weight]="shape.font_bold ? 'bold' : 'normal'"
                     [style.font-style]="shape.font_italic ? 'italic' : 'normal'"
                     [style.text-align]="shape.alignment"
                     [style.background-color]="shape.fill_color || 'transparent'">
                  <p *ngFor="let para of shape.paragraphs" class="mb-1"
                     [style.text-align]="para.alignment"
                     [style.padding-left.px]="para.level * 20">
                    {{ para.text }}
                  </p>
                </div>
                <!-- Table -->
                <table *ngIf="shape.table_data" class="w-full border-collapse border border-gray-300">
                  <tbody>
                    <tr *ngFor="let row of shape.table_data.rows; let ri = index">
                      <td *ngFor="let cell of row; let ci = index"
                          class="border border-gray-300 p-2 text-sm"
                          [style.font-weight]="ri < shape.table_data.header_count ? 'bold' : 'normal'"
                          [style.background-color]="ri < shape.table_data.header_count ? '#f3f4f6' : 'white'">
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <!-- Image placeholder -->
                <div *ngIf="shape.has_image"
                     class="bg-gray-200 rounded flex items-center justify-center p-4 text-gray-500">
                  <span class="material-icons mr-2">image</span>
                  Image {{ shape.image_index }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PptxViewerComponent implements OnChanges {
  @Input() docId: string | null = null;

  slides: SlideData[] = [];
  currentSlide = 0;
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  get currentSlideData(): SlideData | null {
    return this.slides[this.currentSlide] || null;
  }

  get slideAspectRatio(): string {
    const s = this.currentSlideData;
    if (!s || !s.height_px) return '16 / 9';
    return `${s.width_px} / ${s.height_px}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['docId'] && this.docId) {
      this.loadSlides();
    }
  }

  loadSlides(): void {
    if (!this.docId) return;
    this.loading = true;
    this.error = null;
    this.api.getSlides(this.docId).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.slides = res.data.slides;
          this.currentSlide = 0;
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Failed to load slides: ' + (err.message || 'Unknown error');
      },
    });
  }

  prevSlide(): void {
    if (this.currentSlide > 0) this.currentSlide--;
  }

  nextSlide(): void {
    if (this.currentSlide < this.slides.length - 1) this.currentSlide++;
  }
}
