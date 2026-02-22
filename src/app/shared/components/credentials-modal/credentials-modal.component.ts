import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-credentials-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credentials-modal.component.html',
  styleUrls: ['./credentials-modal.component.scss']
})
export class CredentialsModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Credenciales de acceso';
  @Input() nombre = '';
  @Input() email = '';
  @Input() password = '';
  @Input() warningText = '';

  @Output() closed = new EventEmitter<void>();

  copiedState: 'none' | 'email' | 'password' | 'all' = 'none';

  close(): void {
    this.copiedState = 'none';
    this.closed.emit();
  }

  async copyEmail(): Promise<void> {
    if (!this.email) return;
    const copied = await this.copyToClipboard(this.email);
    this.copiedState = copied ? 'email' : 'none';
  }

  async copyPassword(): Promise<void> {
    if (!this.password) return;
    const copied = await this.copyToClipboard(this.password);
    this.copiedState = copied ? 'password' : 'none';
  }

  async copyAll(): Promise<void> {
    const credentialsText = `Nombre: ${this.nombre}\nEmail: ${this.email}\nContraseña: ${this.password}`;
    const copied = await this.copyToClipboard(credentialsText);
    this.copiedState = copied ? 'all' : 'none';
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }
}
