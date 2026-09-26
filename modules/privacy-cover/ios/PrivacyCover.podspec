Pod::Spec.new do |s|
  s.name           = 'PrivacyCover'
  s.version        = '1.0.0'
  s.summary        = 'Covers Annum in the App Switcher snapshot.'
  s.description    = 'Adds a solid cover over every window while the scene is inactive.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
