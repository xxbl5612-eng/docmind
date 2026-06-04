import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-file-icon',
  standalone: true,
  imports: [NgClass, MatIconModule],
  template: `
    <mat-icon
      class="text-2xl"
      [ngClass]="colorClass()"
      [attr.aria-label]="(format || 'file') + ' icon'">
      {{ iconName() }}
    </mat-icon>
  `,
})
export class FileIconComponent {
  @Input() format: string | null = null;

  private readonly iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    docx: 'description',
    doc: 'description',
    pptx: 'slideshow',
    ppt: 'slideshow',
    xlsx: 'table_chart',
    xls: 'table_chart',
    csv: 'table_chart',
    md: 'article',
    markdown: 'article',
    txt: 'text_snippet',
    html: 'code',
    htm: 'code',
    json: 'data_object',
    xml: 'code',
    yaml: 'code',
    yml: 'code',
  };

  private readonly colorMap: Record<string, string> = {
    pdf: 'text-red-500',
    docx: 'text-blue-600',
    doc: 'text-blue-600',
    pptx: 'text-orange-500',
    ppt: 'text-orange-500',
    xlsx: 'text-green-600',
    xls: 'text-green-600',
    csv: 'text-green-600',
    md: 'text-purple-500',
    markdown: 'text-purple-500',
    txt: 'text-gray-500',
    html: 'text-amber-600',
    htm: 'text-amber-600',
    json: 'text-yellow-600',
  };

  iconName(): string {
    const key = (this.format || '').toLowerCase();
    return this.iconMap[key] || 'insert_drive_file';
  }

  colorClass(): string {
    const key = (this.format || '').toLowerCase();
    return this.colorMap[key] || 'text-gray-400';
  }
}
