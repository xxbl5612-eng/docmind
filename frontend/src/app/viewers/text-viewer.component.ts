import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-text-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 bg-white rounded-lg border border-gray-200">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-800">{{ title }}</h3>
        <span class="text-sm text-gray-500">{{ charCount | number }} chars</span>
      </div>
      <textarea
        class="w-full min-h-[400px] p-4 font-mono text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        [value]="content"
        (input)="onContentChange($event)"
        [readonly]="!editable"
      ></textarea>
    </div>
  `,
})
export class TextViewerComponent {
  @Input() content = '';
  @Input() title = '文档内容';
  @Input() editable = false;

  get charCount(): number {
    return this.content?.length || 0;
  }

  onContentChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.content = target.value;
  }
}
