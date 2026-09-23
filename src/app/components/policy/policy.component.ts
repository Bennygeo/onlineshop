import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from 'src/app/services/cart.service';

interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  icon: string;
}

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './policy.component.html',
  styleUrl: './policy.component.scss'
})
export class PolicyComponent implements OnInit {

  activeTab: 'faq' | 'privacy' | 'terms' | 'refund' = 'faq';
  searchQuery: string = '';
  expandedFaq: number | null = 0;

  lastUpdatedDate: string = 'September 2026';
  supportEmail: string = 'hey@tomorrowneeds.in';

  faqs: FaqItem[] = [
    {
      id: 1,
      category: 'Delivery',
      icon: 'local_shipping',
      question: 'How does TomorrowNeeds delivery work and what are the delivery timings?',
      answer: 'We deliver fresh vegetables, fruits, and groceries directly to your doorstep. Morning orders placed before 6:00 AM are delivered in the morning slot (6:30 AM – 9:00 AM), and evening orders are delivered between 5:00 PM – 8:00 PM.'
    },
    {
      id: 2,
      category: 'Refunds & Returns',
      icon: 'replay',
      question: 'What is the return & replacement policy for fresh vegetables and fruits?',
      answer: 'We have a 100% No-Questions-Asked quality guarantee. If you are unsatisfied with any item upon delivery, you can reject it at your doorstep or report it via the app within 2 hours of delivery for an instant refund credited to your TomorrowNeeds Wallet.'
    },
    {
      id: 3,
      category: 'Wallet & Payments',
      icon: 'account_balance_wallet',
      question: 'How does the TomorrowNeeds Wallet work?',
      answer: 'Your TomorrowNeeds Wallet allows for 1-click seamless checkout, instant cashback credits, and immediate refund payouts. You can recharge your wallet anytime using UPI, Debit/Credit Cards, or Net Banking powered by secure Razorpay integration.'
    },
    {
      id: 4,
      category: 'Orders',
      icon: 'shopping_bag',
      question: 'Can I modify or cancel my order after placing it?',
      answer: 'You can cancel or modify your order anytime before it has been dispatched from our distribution hub. Once dispatched, cancellation is subject to delivery partner status, but you can always return any defective item upon arrival.'
    },
    {
      id: 5,
      category: 'Quality & Freshness',
      icon: 'eco',
      question: 'How is TomorrowNeeds produce sourced and quality guaranteed?',
      answer: 'All our produce is procured fresh directly from verified local farms and organic growers every single morning. Each item goes through strict multi-point grading, ozone-safe sanitization, and hygienic eco-friendly packaging before dispatch.'
    },
    {
      id: 6,
      category: 'Referrals & Rewards',
      icon: 'card_giftcard',
      question: 'How do referral rewards work?',
      answer: 'Share your unique referral code from the "Refer and Earn" section with friends and neighbors. When they complete their first order, both of you earn instant wallet bonus credits!'
    }
  ];

  constructor(private cartS: CartService) {
    this.cartS.headerChangeEvent.next("type5");
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setTab(tab: 'faq' | 'privacy' | 'terms' | 'refund'): void {
    this.activeTab = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleFaq(index: number): void {
    this.expandedFaq = this.expandedFaq === index ? null : index;
  }

  get filteredFaqs(): FaqItem[] {
    if (!this.searchQuery.trim()) {
      return this.faqs;
    }
    const q = this.searchQuery.toLowerCase();
    return this.faqs.filter(f =>
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
    );
  }

}
