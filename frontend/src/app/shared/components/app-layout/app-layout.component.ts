import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <app-navbar />
      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [``],
})
export class AppLayoutComponent {}
