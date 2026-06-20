import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChatComponent } from './features/chat/chat/chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
