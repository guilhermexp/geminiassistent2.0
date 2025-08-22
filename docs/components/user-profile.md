# GdmUserProfile Component Documentation

## Overview
`GdmUserProfile` is a Lit-based web component that provides a complete user profile management interface with persona selection capabilities. It displays a user avatar that opens a dropdown menu with various profile management options.

## Component Details

**Tag Name:** `<gdm-user-profile>`  
**File:** `src/components/ui/user-profile.ts`  
**Framework:** LitElement  
**License:** Apache-2.0  

## Features

### Core Functionality
- **User Avatar Display**: Circular avatar with hover effects and persona-based image switching
- **Dropdown Menu**: Profile management options accessible via avatar click
- **Profile Editing**: Modal interface for updating user name and email
- **Persona Selection**: Choose from predefined personas with corresponding avatars
- **Session History**: Trigger session history display (delegated to parent)

### Personas
The component supports 5 persona types with dedicated avatars:
- **Tutor**: Teaching-focused with didactic approach
- **Coding Engineer**: Technical and code-focused responses
- **Direct**: Quick and objective responses
- **Data Analyst**: Business partner focused on data
- **Default**: General helpful assistant

## API Reference

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `activePersona` | `string \| null` | `null` | Currently active persona identifier |

### State Properties (Internal)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `user` | `UserData` | `demoUser` | Current user data (name, email, avatar) |
| `isDropdownOpen` | `boolean` | `false` | Dropdown visibility state |
| `isEditModalOpen` | `boolean` | `false` | Edit profile modal visibility |
| `isPersonaModalOpen` | `boolean` | `false` | Persona selection modal visibility |
| `tempName` | `string` | `''` | Temporary name for editing |
| `tempEmail` | `string` | `''` | Temporary email for editing |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `persona-change` | `{persona: string \| null}` | Fired when user selects a new persona |
| `show-history` | `none` | Fired when user clicks session history option |

### Methods

#### Private Methods
- `toggleDropdown(e: Event)`: Toggle dropdown menu visibility
- `openEditModal()`: Open profile editing modal
- `openPersonaModal()`: Open persona selection modal
- `openHistoryModal()`: Dispatch event to show session history
- `selectPersona(persona: string \| null)`: Select a persona and update avatar
- `handleSaveProfile()`: Save edited profile information
- `handleOutsideClick(e: MouseEvent)`: Close dropdown when clicking outside

## Usage Examples

### Basic Usage
```html
<gdm-user-profile></gdm-user-profile>
```

### With Active Persona
```html
<gdm-user-profile activePersona="tutor"></gdm-user-profile>
```

### Handling Events
```javascript
const profileElement = document.querySelector('gdm-user-profile');

profileElement.addEventListener('persona-change', (event) => {
  console.log('Selected persona:', event.detail.persona);
  // Update application state based on persona
});

profileElement.addEventListener('show-history', () => {
  console.log('Show session history requested');
  // Display session history UI
});
```

## Styling

### CSS Custom Properties
The component uses internal styles but can be customized through CSS inheritance:

```css
gdm-user-profile {
  --avatar-size: 48px;
  --dropdown-background: #2a2a2a;
  --modal-background: #1e1e1e;
  --primary-color: #5078ff;
  --text-color: #eee;
}
```

### Key Style Classes
- `.avatar`: Main avatar image with hover effects
- `.dropdown`: Dropdown menu container
- `.dropdown-item`: Individual menu items
- `.modal-overlay`: Modal backdrop
- `.modal-content`: Modal dialog container
- `.persona-item`: Persona selection buttons

## Data Interfaces

### UserData
```typescript
interface UserData {
  name: string;    // User's display name
  email: string;   // User's email address
  avatar: string;  // Path to avatar image
}
```

### Persona Avatar Mapping
```typescript
private personaAvatars: Record<string, string> = {
  'tutor': '/avatars/tutor.png',
  'coding-engineer': '/avatars/coding-engineer.png',
  'direct': '/avatars/direct.png',
  'data-analyst': '/avatars/data-analyst.png',
  'default': '/avatars/default.png'
}
```

## Lifecycle Hooks

### connectedCallback()
- Registers global click handler for dropdown management
- Sets initial avatar based on active persona prop

### disconnectedCallback()
- Removes global click handler to prevent memory leaks

## Accessibility Features

- **Keyboard Navigation**: Modal dialogs can be closed with ESC key
- **ARIA Labels**: Avatar image includes alt text
- **Focus Management**: Modals trap focus within dialog
- **Click Outside**: Dropdowns close when clicking outside

## Browser Compatibility

- Modern browsers with Web Components support
- Requires LitElement polyfills for older browsers
- CSS animations use standard properties

## Dependencies

- **lit**: Core LitElement framework
- **lit/decorators.js**: TypeScript decorators for properties

## Performance Considerations

- **Event Delegation**: Uses single global click handler
- **Lazy Loading**: Modals rendered only when opened
- **CSS Animations**: Hardware-accelerated transforms
- **Image Optimization**: Avatar images should be optimized (< 50KB)

## Migration Guide

### From React Component
If migrating from a React-based user profile:

1. Replace React props with Lit properties
2. Convert state hooks to @state decorators
3. Update event handlers to use CustomEvents
4. Adapt CSS-in-JS to static CSS

### Integration with Existing Apps
```javascript
// Import the component
import './components/ui/user-profile.js';

// Use in your application
const app = document.getElementById('app');
app.innerHTML = `
  <header>
    <gdm-user-profile></gdm-user-profile>
  </header>
`;
```

## Troubleshooting

### Common Issues

1. **Avatar not updating**: Ensure persona key matches personaAvatars mapping
2. **Dropdown not closing**: Check global click handler is properly registered
3. **Events not firing**: Verify event listeners use `composed: true`
4. **Modal z-index issues**: Adjust z-index values if modals appear behind content

## Future Enhancements

- [ ] Avatar upload functionality
- [ ] Additional persona types
- [ ] Internationalization support
- [ ] Theme customization API
- [ ] Keyboard shortcuts for persona switching
- [ ] Profile data persistence
- [ ] Avatar image lazy loading
- [ ] Animation preferences respect

## Related Components

- `gdm-session-history`: Displays user session history
- `gdm-settings`: Application settings management
- `gdm-theme-toggle`: Dark/light theme switcher

## Support

For issues or questions, please refer to the project's issue tracker or contact the development team.