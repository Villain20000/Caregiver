import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';

export type PostCategory = 'milestone' | 'announcement' | 'visiting-hours' | 'celebration' | 'reminder';

export interface NoticePost {
  id: number;
  author: string;
  authorInitials: string;
  authorRole: string;
  createdAt: Date;
  content: string;
  category: PostCategory;
  pinned: boolean;
  imagePlaceholder?: string;
}

const CATEGORIES: { value: PostCategory; label: string; tone: 'info' | 'success' | 'warning' | 'primary' | 'neutral' }[] = [
  { value: 'milestone', label: 'Milestone', tone: 'success' },
  { value: 'announcement', label: 'Announcement', tone: 'primary' },
  { value: 'visiting-hours', label: 'Visiting Hours', tone: 'warning' },
  { value: 'celebration', label: 'Celebration', tone: 'info' },
  { value: 'reminder', label: 'Reminder', tone: 'neutral' },
];

const CATEGORY_EMOJIS: Record<PostCategory, string> = {
  milestone: '🏆',
  announcement: '📢',
  'visiting-hours': '🕐',
  celebration: '🎉',
  reminder: '📌',
};

const PRESEEDED_POSTS: NoticePost[] = [
  {
    id: 1, author: 'Sofia Mendes', authorInitials: 'SM', authorRole: 'Family Caregiver',
    createdAt: new Date(Date.now() - 3600000 * 2), content: 'Walter had a great physio session today! He managed 10 steps with the walker. So proud of his progress! 💪',
    category: 'milestone', pinned: true,
  },
  {
    id: 2, author: 'Dr. Lena Park', authorInitials: 'LP', authorRole: 'Physician',
    createdAt: new Date(Date.now() - 3600000 * 5), content: 'Care plan review scheduled for Thursday at 2pm. All team members please review the updated medication list beforehand.',
    category: 'announcement', pinned: true,
  },
  {
    id: 3, author: 'Maya Patel', authorInitials: 'MP', authorRole: 'Nurse',
    createdAt: new Date(Date.now() - 3600000 * 8), content: 'Visiting hours have been extended on weekends: 10am-7pm starting this Saturday. Please coordinate with the front desk.',
    category: 'visiting-hours', pinned: false,
  },
  {
    id: 4, author: 'Tomás Reyes', authorInitials: 'TR', authorRole: 'Nurse',
    createdAt: new Date(Date.now() - 86400000), content: 'Happy Birthday to our wonderful patient Eleanor! 🎂🎈 The team brought cake to the common room.',
    category: 'celebration', pinned: false,
  },
  {
    id: 5, author: 'Ines Costa', authorInitials: 'IC', authorRole: 'Therapist',
    createdAt: new Date(Date.now() - 86400000 * 2), content: 'Reminder: Group therapy sessions will now be held in the new Activity Room B. Please update your calendars.',
    category: 'reminder', pinned: false,
  },
  {
    id: 6, author: 'Priya Shah', authorInitials: 'PS', authorRole: 'Dispatcher',
    createdAt: new Date(Date.now() - 86400000 * 3), content: 'Emergency drill scheduled for next Tuesday at 10am. All staff must participate. Details to follow.',
    category: 'announcement', pinned: false,
  },
  {
    id: 7, author: 'Sofia Mendes', authorInitials: 'SM', authorRole: 'Family Caregiver',
    createdAt: new Date(Date.now() - 86400000 * 4), content: 'Walter\'s daughter visiting from out of town this weekend! Would any nurse be available for a quick check-in Saturday morning?',
    category: 'visiting-hours', pinned: false,
  },
  {
    id: 8, author: 'Chef Yuki Tanaka', authorInitials: 'YT', authorRole: 'Nutritionist',
    createdAt: new Date(Date.now() - 86400000 * 5), content: 'New menu items tested and approved! Mediterranean quinoa bowl and turmeric ginger smoothie are now available for lunch options. 🥗',
    category: 'milestone', pinned: false,
  },
];

const CAN_POST_ROLES: readonly Role[] = [Role.FAMILY, Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.THERAPIST, Role.SOCIAL_WORKER];

@Component({
  selector: 'cv-notice-board',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent, CvModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">notice-board</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Family Notice Board
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Stay connected with family announcements, milestones, and important updates.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Feed -->
        <div class="lg:col-span-2 space-y-4">
          <!-- New Post Form (for allowed roles) -->
          <cv-card *ngIf="canPost()" title="New Post" subtitle="Share an update with the family">
            <div class="space-y-4 py-2">
              <textarea
                [(ngModel)]="newPostContent"
                class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-shadow"
                rows="3"
                placeholder="What would you like to share?"
              ></textarea>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    *ngFor="let cat of categories"
                    type="button"
                    (click)="newPostCategory.set(cat.value)"
                    class="rounded-full px-3 py-1 text-xs font-medium transition-all border"
                    [ngClass]="newPostCategory() === cat.value
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'"
                  >
                    {{ CATEGORY_EMOJIS[cat.value] }} {{ cat.label }}
                  </button>
                </div>
                <cv-button variant="primary" size="sm" (click)="createPost()" [disabled]="!newPostContent().trim()">
                  Post
                </cv-button>
              </div>
            </div>
          </cv-card>

          <!-- Posts Feed -->
          <ng-container *ngFor="let post of sortedPosts(); trackBy: trackPostId">
            <div
              class="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border shadow-card transition-all hover:shadow-soft"
              [ngClass]="post.pinned ? 'border-amber-200/60 dark:border-amber-500/30 ring-1 ring-amber-200/30 dark:ring-amber-500/20' : 'border-slate-200/60 dark:border-slate-800'"
            >
              <!-- Pin indicator -->
              <div *ngIf="post.pinned" class="flex items-center gap-1.5 px-5 pt-3">
                <svg class="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                </svg>
                <span class="text-[10px] font-bold uppercase tracking-widest text-amber-500">Pinned</span>
              </div>

              <div class="p-5">
                <!-- Post Header -->
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-sm font-bold shadow-sm">
                      {{ post.authorInitials }}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate">{{ post.author }}</span>
                        <cv-badge tone="neutral" [dot]="false">{{ post.authorRole }}</cv-badge>
                      </div>
                      <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {{ post.createdAt | date:'MMM d, y · h:mm a' }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <cv-badge [tone]="categoryTone(post.category)">{{ CATEGORY_EMOJIS[post.category] }} {{ categoryLabel(post.category) }}</cv-badge>
                    <button
                      *ngIf="canPost()"
                      type="button"
                      (click)="togglePin(post)"
                      class="rounded-lg p-1.5 transition-colors"
                      [ngClass]="post.pinned
                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
                      [attr.aria-label]="post.pinned ? 'Unpin post' : 'Pin post'"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Post Content -->
                <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {{ post.content }}
                </p>

                <!-- Image Placeholder -->
                <div
                  *ngIf="post.imagePlaceholder"
                  class="mt-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 h-32 flex items-center justify-center border border-slate-200/40 dark:border-slate-700/40"
                >
                  <div class="text-center">
                    <svg class="h-8 w-8 mx-auto text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{{ post.imagePlaceholder }}</p>
                  </div>
                </div>
              </div>
            </div>
          </ng-container>

          <p *ngIf="sortedPosts().length === 0" class="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
            No posts yet. Be the first to share an update!
          </p>
        </div>

        <!-- Sidebar: Categories Legend -->
        <div class="space-y-4">
          <cv-card title="Categories" subtitle="Filter by type">
            <div class="space-y-2">
              <button
                *ngFor="let cat of categories"
                type="button"
                (click)="selectedCategory.set(selectedCategory() === cat.value ? null : cat.value)"
                class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                [ngClass]="selectedCategory() === cat.value
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'"
              >
                <span class="text-lg">{{ CATEGORY_EMOJIS[cat.value] }}</span>
                <span>{{ cat.label }}</span>
                <span class="ml-auto text-xs text-slate-400 dark:text-slate-500">
                  {{ postsByCategory()[cat.value]?.length || 0 }}
                </span>
              </button>
              <button
                *ngIf="selectedCategory()"
                type="button"
                (click)="selectedCategory.set(null)"
                class="w-full text-center text-xs text-indigo-500 hover:text-indigo-400 mt-2 transition-colors"
              >
                Clear filter
              </button>
            </div>
          </cv-card>

          <cv-card title="Notice Board Info" subtitle="Quick stats">
            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Total Posts</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ posts().length }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Pinned</span>
                <span class="font-semibold text-amber-600 dark:text-amber-400">{{ pinnedCount() }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Categories</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ uniqueCategories().length }}</span>
              </div>
            </div>
          </cv-card>
        </div>
      </div>

      <!-- New Post Modal -->
      <cv-modal [open]="showNewPostModal()" title="Create New Post" size="lg" (closed)="showNewPostModal.set(false)">
        <div class="space-y-4">
          <textarea
            [(ngModel)]="newPostContent"
            class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-shadow"
            rows="4"
            placeholder="Write your post..."
          ></textarea>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              *ngFor="let cat of categories"
              type="button"
              (click)="newPostCategory.set(cat.value)"
              class="rounded-full px-3 py-1 text-xs font-medium transition-all border"
              [ngClass]="newPostCategory() === cat.value
                ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'"
            >
              {{ CATEGORY_EMOJIS[cat.value] }} {{ cat.label }}
            </button>
          </div>
          <div cv-modal-footer class="flex items-center gap-2">
            <cv-button variant="ghost" (click)="showNewPostModal.set(false)">Cancel</cv-button>
            <cv-button variant="primary" (click)="createPost(); showNewPostModal.set(false)" [disabled]="!newPostContent().trim()">Publish Post</cv-button>
          </div>
        </div>
      </cv-modal>
    </div>
  `,
})
export class NoticeBoardComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);

  readonly categories = CATEGORIES;
  readonly CATEGORY_EMOJIS = CATEGORY_EMOJIS;

  readonly newPostContent = signal('');
  readonly newPostCategory = signal<PostCategory>('announcement');
  readonly showNewPostModal = signal(false);
  readonly selectedCategory = signal<PostCategory | null>(null);

  private readonly postsSignal = signal<NoticePost[]>(PRESEEDED_POSTS);
  readonly posts = this.postsSignal.asReadonly();

  readonly canPost = computed(() => {
    const role = this.roleService.activeRole();
    return CAN_POST_ROLES.includes(role) || role === Role.ADMIN;
  });

  readonly pinnedCount = computed(() => this.posts().filter((p) => p.pinned).length);

  readonly uniqueCategories = computed(() => {
    const cats = new Set(this.posts().map((p) => p.category));
    return [...cats];
  });

  readonly postsByCategory = computed(() => {
    const map: Record<string, NoticePost[] | undefined> = {};
    for (const post of this.posts()) {
      const cat = post.category;
      if (!map[cat]) map[cat] = [];
      map[cat]!.push(post);
    }
    return map;
  });

  readonly sortedPosts = computed(() => {
    let filtered = this.posts();
    const selectedCat = this.selectedCategory();
    if (selectedCat) {
      filtered = filtered.filter((p) => p.category === selectedCat);
    }
    return [...filtered].sort((a, b) => {
      // Pinned first, then by date descending
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  });

  private postIdCounter = PRESEEDED_POSTS.length;

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Notice-board';
  }

  categoryTone(cat: PostCategory): 'info' | 'success' | 'warning' | 'primary' | 'neutral' {
    return CATEGORIES.find((c) => c.value === cat)?.tone ?? 'neutral';
  }

  categoryLabel(cat: PostCategory): string {
    return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  createPost(): void {
    const content = this.newPostContent().trim();
    if (!content) return;

    const currentUser = this.roleService.currentUser();
    const post: NoticePost = {
      id: ++this.postIdCounter,
      author: currentUser.name,
      authorInitials: currentUser.avatar,
      authorRole: ROLE_LABELS[currentUser.role],
      createdAt: new Date(),
      content,
      category: this.newPostCategory(),
      pinned: false,
    };

    this.postsSignal.update((posts) => [post, ...posts]);
    this.newPostContent.set('');
    this.newPostCategory.set('announcement');
  }

  togglePin(post: NoticePost): void {
    this.postsSignal.update((posts) =>
      posts.map((p) => (p.id === post.id ? { ...p, pinned: !p.pinned } : p))
    );
  }

  trackPostId = (_: number, post: NoticePost): number => post.id;
}
