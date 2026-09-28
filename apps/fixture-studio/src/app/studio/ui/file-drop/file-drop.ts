import { Component, input, output, signal } from '@angular/core';

/** A drop zone that is also a file picker; the file is only handed to the parent, never uploaded. */
@Component({
  selector: 'fs-file-drop',
  templateUrl: './file-drop.html',
  styleUrl: './file-drop.scss'
})
export class FileDrop {
  public readonly heading = input.required<string>();
  public readonly hint = input.required<string>();
  public readonly accept = input.required<string>();

  public readonly picked = output<File>();

  protected readonly isDragging = signal(false);

  protected onPicked(event: Event): void {
    const target = event.target;
    const isFileInput = target instanceof HTMLInputElement;

    if (!isFileInput) return;

    const file = target.files?.[0];

    target.value = '';

    if (file !== undefined) this.picked.emit(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(): void {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files[0];

    if (file !== undefined) this.picked.emit(file);
  }
}
