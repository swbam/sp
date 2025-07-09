import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoteButton } from '@/components/VoteButton'

/**
 * Unit tests for VoteButton component
 * 
 * Tests the core voting functionality UI component
 */

// Mock dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: vi.fn(() => ({
    user: null,
    isLoading: false
  }))
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('VoteButton Component', () => {
  const defaultProps = {
    upvotes: 5,
    downvotes: 2,
    onVote: vi.fn(),
    disabled: false,
    userVote: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders vote buttons with correct vote counts', () => {
    render(<VoteButton {...defaultProps} />)
    
    // Should display upvote button
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    expect(upvoteButton).toBeInTheDocument()
    
    // Should display downvote button
    const downvoteButton = screen.getByRole('button', { name: /downvote/i })
    expect(downvoteButton).toBeInTheDocument()
    
    // Should display net score (upvotes - downvotes = 3)
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('displays zero score correctly', () => {
    render(<VoteButton {...defaultProps} upvotes={3} downvotes={3} />)
    
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('displays negative score correctly', () => {
    render(<VoteButton {...defaultProps} upvotes={2} downvotes={5} />)
    
    expect(screen.getByText('-3')).toBeInTheDocument()
  })

  it('calls onVote with correct type when upvote is clicked', async () => {
    const user = userEvent.setup()
    const mockOnVote = vi.fn()
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    await user.click(upvoteButton)
    
    expect(mockOnVote).toHaveBeenCalledWith('up')
  })

  it('calls onVote with correct type when downvote is clicked', async () => {
    const user = userEvent.setup()
    const mockOnVote = vi.fn()
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} />)
    
    const downvoteButton = screen.getByRole('button', { name: /downvote/i })
    await user.click(downvoteButton)
    
    expect(mockOnVote).toHaveBeenCalledWith('down')
  })

  it('shows active state for user upvote', () => {
    render(<VoteButton {...defaultProps} userVote="up" />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    
    // Should have active/selected styling
    expect(upvoteButton).toHaveClass(/green|active|selected/)
  })

  it('shows active state for user downvote', () => {
    render(<VoteButton {...defaultProps} userVote="down" />)
    
    const downvoteButton = screen.getByRole('button', { name: /downvote/i })
    
    // Should have active/selected styling
    expect(downvoteButton).toHaveClass(/red|active|selected/)
  })

  it('disables buttons when disabled prop is true', () => {
    render(<VoteButton {...defaultProps} disabled={true} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    const downvoteButton = screen.getByRole('button', { name: /downvote/i })
    
    expect(upvoteButton).toBeDisabled()
    expect(downvoteButton).toBeDisabled()
  })

  it('does not call onVote when disabled', async () => {
    const user = userEvent.setup()
    const mockOnVote = vi.fn()
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} disabled={true} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    await user.click(upvoteButton)
    
    expect(mockOnVote).not.toHaveBeenCalled()
  })

  it('has proper accessibility attributes', () => {
    render(<VoteButton {...defaultProps} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    const downvoteButton = screen.getByRole('button', { name: /downvote/i })
    
    // Should have accessible names
    expect(upvoteButton).toHaveAccessibleName()
    expect(downvoteButton).toHaveAccessibleName()
    
    // Should be keyboard accessible
    expect(upvoteButton).toHaveAttribute('tabIndex', '0')
    expect(downvoteButton).toHaveAttribute('tabIndex', '0')
  })

  it('supports keyboard interaction', async () => {
    const mockOnVote = vi.fn()
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    
    // Focus and press Enter
    upvoteButton.focus()
    fireEvent.keyDown(upvoteButton, { key: 'Enter', code: 'Enter' })
    
    expect(mockOnVote).toHaveBeenCalledWith('up')
    
    // Test Space key
    vi.clearAllMocks()
    fireEvent.keyDown(upvoteButton, { key: ' ', code: 'Space' })
    
    expect(mockOnVote).toHaveBeenCalledWith('up')
  })

  it('handles large vote numbers correctly', () => {
    render(<VoteButton {...defaultProps} upvotes={9999} downvotes={1000} />)
    
    // Should display formatted large numbers
    expect(screen.getByText('+8999')).toBeInTheDocument()
  })

  it('handles zero votes correctly', () => {
    render(<VoteButton {...defaultProps} upvotes={0} downvotes={0} />)
    
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('maintains focus after vote interaction', async () => {
    const user = userEvent.setup()
    const mockOnVote = vi.fn()
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    
    await user.click(upvoteButton)
    
    // Button should maintain focus for keyboard users
    expect(upvoteButton).toHaveFocus()
  })

  it('updates visual state immediately on vote', async () => {
    const user = userEvent.setup()
    
    // Use a controlled component approach
    let currentUserVote = null
    const mockOnVote = vi.fn((voteType) => {
      currentUserVote = voteType
    })
    
    const { rerender } = render(
      <VoteButton {...defaultProps} onVote={mockOnVote} userVote={currentUserVote} />
    )
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    await user.click(upvoteButton)
    
    // Simulate state update
    rerender(
      <VoteButton {...defaultProps} onVote={mockOnVote} userVote="up" />
    )
    
    // Should show active upvote state
    expect(upvoteButton).toHaveClass(/green|active|selected/)
  })

  it('shows loading state during vote submission', async () => {
    const user = userEvent.setup()
    let resolveVote: (value?: any) => void = () => {}
    
    const mockOnVote = vi.fn(() => {
      return new Promise(resolve => {
        resolveVote = resolve
      })
    })
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    
    // Start voting
    const votePromise = user.click(upvoteButton)
    
    // Should show loading state
    await waitFor(() => {
      expect(upvoteButton).toHaveAttribute('disabled')
    })
    
    // Complete the vote
    resolveVote()
    await votePromise
    
    // Should return to normal state
    expect(upvoteButton).not.toHaveAttribute('disabled')
  })

  it('handles rapid clicking gracefully', async () => {
    const user = userEvent.setup()
    const mockOnVote = vi.fn()
    
    render(<VoteButton {...defaultProps} onVote={mockOnVote} />)
    
    const upvoteButton = screen.getByRole('button', { name: /upvote/i })
    
    // Rapid clicks
    await user.click(upvoteButton)
    await user.click(upvoteButton)
    await user.click(upvoteButton)
    
    // Should debounce or handle gracefully
    // Exact behavior depends on implementation
    expect(mockOnVote).toHaveBeenCalled()
  })
})