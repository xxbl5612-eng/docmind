import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface LanguageOption {
  code: string;
  label: string;
}

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    MatButton,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatIcon,
    TranslateModule,
  ],
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="langMenu"
      class="!text-gray-500 hover:!bg-gray-100 !w-9 !h-9 !leading-9 !text-xs !font-semibold"
      aria-label="Switch language"
    >
      {{ currentLangLabel }}
    </button>
    <mat-menu #langMenu="matMenu">
      <button
        mat-menu-item
        *ngFor="let lang of languages"
        (click)="switchLanguage(lang.code)"
        [class.!font-bold]="lang.code === currentLang"
        class="flex items-center gap-2"
      >
        <mat-icon
          *ngIf="lang.code === currentLang"
          class="!mr-2 !text-blue-600 !text-base !w-4 !h-4 !leading-4"
        >
          check
        </mat-icon>
        <span
          [class.!ml-6]="lang.code !== currentLang"
        >
          {{ lang.label }}
        </span>
      </button>
    </mat-menu>
  `,
  styles: [``],
})
export class LanguageSwitcherComponent {
  private readonly translate = inject(TranslateService);

  readonly languages: LanguageOption[] = [
    { code: 'zh', label: 'ZH' },
    { code: 'en', label: 'EN' },
  ];

  get currentLang(): string {
    return this.translate.currentLang || this.translate.defaultLang;
  }

  get currentLangLabel(): string {
    return this.currentLang === 'zh' ? 'ZH' : 'EN';
  }

  switchLanguage(lang: string): void {
    this.translate.use(lang);
  }
}
