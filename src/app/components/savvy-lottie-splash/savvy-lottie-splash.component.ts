// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    input,
    output,
    viewChild,
} from '@angular/core';
import type { AnimationItem } from 'lottie-web';
import lottie from 'lottie-web';

/** Fallback if Lottie never fires `complete` (corrupt JSON, renderer hang). */
const LOTTIE_INTRO_MAX_WAIT_MS = 25000;

@Component({
    selector: 'app-savvy-lottie-splash',
    standalone: true,
    templateUrl: 'savvy-lottie-splash.component.html',
    styleUrl: 'savvy-lottie-splash.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.savvy-lottie-splash--exiting]': 'exiting()',
    },
})
export class SavvyLottieSplashComponent implements AfterViewInit, OnDestroy {

    readonly exiting = input(false);
    /** Emitted once when the intro animation is done (or on failure / safety timeout). */
    readonly introFinished = output<void>();

    private readonly lottieHost = viewChild.required<ElementRef<HTMLElement>>('lottieHost');

    private animation?: AnimationItem;
    private finishedEmitted = false;
    private maxWaitTimer?: ReturnType<typeof setTimeout>;

    /**
     * @inheritdoc
     */
    ngAfterViewInit(): void {
        // Defer until layout so the container has dimensions (fullscreen intro).
        requestAnimationFrame(() => this.initLottie());
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.clearMaxWaitTimer();
        this.animation?.destroy();
        this.animation = undefined;
    }

    /**
     * Initialise Lottie player (single play, no loop).
     */
    protected initLottie(): void {
        if (this.animation) {
            return;
        }

        const container = this.lottieHost().nativeElement;
        if (!container) {
            this.emitIntroFinishedOnce();

            return;
        }

        try {
            this.animation = lottie.loadAnimation({
                container,
                renderer: 'svg',
                loop: false,
                autoplay: true,
                path: 'assets/animations/savvy-robot.json',
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet',
                },
            });
        } catch {
            this.emitIntroFinishedOnce();

            return;
        }

        this.animation.addEventListener('complete', () => this.emitIntroFinishedOnce());
        this.animation.addEventListener('data_failed', () => this.emitIntroFinishedOnce());

        this.maxWaitTimer = setTimeout(() => this.emitIntroFinishedOnce(), LOTTIE_INTRO_MAX_WAIT_MS);
    }

    /**
     * Emit intro finished at most once.
     */
    protected emitIntroFinishedOnce(): void {
        if (this.finishedEmitted) {
            return;
        }
        this.finishedEmitted = true;
        this.clearMaxWaitTimer();
        this.introFinished.emit();
    }

    /**
     * Clear safety timer.
     */
    protected clearMaxWaitTimer(): void {
        if (this.maxWaitTimer !== undefined) {
            clearTimeout(this.maxWaitTimer);
            this.maxWaitTimer = undefined;
        }
    }

}
